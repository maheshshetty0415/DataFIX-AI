import os
import re
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db, Dataset, Issue, AuditLog
from backend.models import (
    RepairActionResponse,
    AutoRepairResponse,
    ValidationResponse,
    CompareResponse,
)
from backend.services.repair_engine import accept_repair, reject_repair, auto_repair
from backend.services.validator import validate_dataset
from backend.services.data_loader import (
    load_dataset_df,
    df_to_preview_records,
    get_dataset_file_path,
)

router = APIRouter(prefix="/api", tags=["Repair"])


@router.post("/repair/{dataset_id}/accept/{issue_id}", response_model=RepairActionResponse)
def accept_single_repair(
    dataset_id: str,
    issue_id: str,
    db: Session = Depends(get_db)
):
    """Apply a single recommended fix to the cleaned dataset."""
    result = accept_repair(db, dataset_id, issue_id)
    return RepairActionResponse(**result)


@router.post("/repair/{dataset_id}/reject/{issue_id}", response_model=RepairActionResponse)
def reject_single_repair(
    dataset_id: str,
    issue_id: str,
    db: Session = Depends(get_db)
):
    """Reject a suggested fix and preserve the original value in the cleaned dataset."""
    result = reject_repair(db, dataset_id, issue_id)
    return RepairActionResponse(**result)


@router.post("/repair/{dataset_id}/auto", response_model=AutoRepairResponse)
def auto_repair_dataset(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """
    Run autonomous repair on safe issues:
    - Whitespace trimming
    - Categorical casing standardization
    - Missing value imputation for non-ID columns
    - Exact duplicate removal
    """
    result = auto_repair(db, dataset_id)
    return AutoRepairResponse(**result)


@router.post("/repair/{dataset_id}/validate", response_model=ValidationResponse)
def validate_repaired_data(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Validate repaired dataset against original schema and integrity rules."""
    result = validate_dataset(db, dataset_id)
    return ValidationResponse(**result)


@router.get("/compare/{dataset_id}", response_model=CompareResponse)
def compare_dataset_versions(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """
    Compare original and cleaned versions of the dataset:
    - Real before and after issue counts per category
    - Actual accepted and auto-repaired modifications from AuditLog and Issue
    - Accurate quality score lift calculation
    - Deleted rows with original references
    - Full previews of original and cleaned data
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    orig_df = load_dataset_df(dataset_id, is_cleaned=False)

    cleaned_path = get_dataset_file_path(dataset_id, is_cleaned=True)
    is_cleaned = cleaned_path is not None and os.path.exists(cleaned_path)
    if is_cleaned:
        cleaned_df = load_dataset_df(dataset_id, is_cleaned=True)
    else:
        cleaned_df = orig_df.copy(deep=True)

    all_issues = db.query(Issue).filter(Issue.dataset_id == dataset_id).all()
    total_detected = len(all_issues)
    total_fixed = sum(1 for i in all_issues if i.status in ["accepted", "auto_fixed"])
    remaining = total_detected - total_fixed

    score_before = dataset.quality_score_before
    score_after = dataset.quality_score_after
    score_diff = None
    if score_before is not None and score_after is not None:
        score_diff = round(score_after - score_before, 2)

    rows_diff = max(0, len(orig_df) - len(cleaned_df))
    duplicates_fixed = sum(
        1 for i in all_issues if i.issue_type == "duplicate" and i.status in ["accepted", "auto_fixed"]
    )
    cells_modified = sum(
        1 for i in all_issues if i.issue_type != "duplicate" and i.status in ["accepted", "auto_fixed"]
    )

    # 1. Category comparison metrics (Before vs After)
    CATEGORIES = [
        ("missing_value", "Missing Values"),
        ("duplicate", "Duplicates"),
        ("invalid_format", "Invalid Formats"),
        ("inconsistency", "Inconsistencies"),
        ("anomaly", "Anomalies"),
    ]

    issues_by_category_before = {}
    issues_by_category_after = {}
    category_comparison = []

    for key, label in CATEGORIES:
        cat_all = [i for i in all_issues if i.issue_type == key]
        cat_active = [i for i in cat_all if i.status in ["detected", "rejected"]]
        cat_fixed = [i for i in cat_all if i.status in ["accepted", "auto_fixed"]]
        before_count = len(cat_all)
        after_count = len(cat_active)
        issues_by_category_before[label] = before_count
        issues_by_category_after[label] = after_count
        category_comparison.append({
            "category": label,
            "before": before_count,
            "after": after_count,
            "fixed": len(cat_fixed),
            "Before Repair": before_count,
            "After Repair": after_count,
        })

    # 2. Build actual modification records from AuditLog & confirmed issues
    audit_logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.dataset_id == dataset_id,
            AuditLog.user_decision.in_(["accepted", "auto"])
        )
        .order_by(AuditLog.row_number.asc(), AuditLog.timestamp.asc())
        .all()
    )

    seen_keys = set()
    modified_records = []
    deleted_rows = []

    for log in audit_logs:
        key = (log.row_number, log.column_name)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        is_dup = log.issue_type == "duplicate" or log.new_value == "Row removed" or log.column_name in [None, "Entire Row"]
        is_add = (log.original_value is None or str(log.original_value).strip().lower() in ["none", "<null>", "nan", ""]) and not is_dup

        change_type = "Format Rectification"
        if log.issue_type == "missing_value":
            change_type = "Missing Imputation"
        elif log.issue_type == "duplicate":
            change_type = "Duplicate Removal"
        elif log.issue_type == "inconsistency":
            change_type = "Format Normalization"
        elif log.issue_type == "invalid_format":
            change_type = "Format Rectification"
        elif log.issue_type == "anomaly":
            change_type = "Anomaly Remediation"

        orig_val = log.original_value
        if orig_val is None or str(orig_val).strip() in ["None", "<null>", "nan"]:
            orig_val = "NULL"

        new_val = log.new_value
        conf_val = round(float(log.confidence) * 100) if (log.confidence and log.confidence <= 1.0) else int(log.confidence or 95)
        repair_method = log.reason or "Value updated"
        matching_row = None

        if is_dup:
            text_to_search = f"{log.reason or ''} {log.issue_type or ''}"
            m = re.search(r'row\s+(\d+)', text_to_search, re.IGNORECASE)
            if m:
                matching_row = int(m.group(1))
            else:
                matching_iss = next((i for i in all_issues if i.row_number == log.row_number and i.issue_type == "duplicate"), None)
                if matching_iss and matching_iss.description:
                    m2 = re.search(r'row\s+(\d+)', matching_iss.description, re.IGNORECASE)
                    if m2:
                        matching_row = int(m2.group(1))
            if matching_row is not None:
                repair_method = f"Exact duplicate of Row #{matching_row} (Row #{matching_row} retained; Row #{log.row_number} removed)"
                orig_val = f"Duplicate of Row #{matching_row}"
                new_val = f"Row removed (Row #{matching_row} kept)"
            else:
                repair_method = "Exact duplicate removed (Original record retained)"
                new_val = "Row removed"

        rec = {
            "id": log.id,
            "row_index": log.row_number,
            "row_number": log.row_number,
            "column_name": log.column_name or "Entire Row",
            "original_value": orig_val,
            "new_value": new_val,
            "change_type": change_type,
            "repair_method": repair_method,
            "confidence": conf_val,
            "status": "Accepted" if log.user_decision == "accepted" else "Auto-repaired",
            "is_deletion": is_dup,
            "is_addition": is_add,
            "matching_row": matching_row,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        modified_records.append(rec)
        if is_dup:
            deleted_rows.append(rec)

    # Merge any issues marked accepted/auto_fixed without an audit entry
    for iss in all_issues:
        if iss.status in ["accepted", "auto_fixed"]:
            key = (iss.row_number, iss.column_name)
            if key not in seen_keys:
                seen_keys.add(key)
                is_dup = iss.issue_type == "duplicate" or iss.suggested_value == "Remove duplicate row" or iss.column_name in [None, "Entire Row"]
                is_add = (iss.original_value is None or str(iss.original_value).strip().lower() in ["none", "<null>", "nan", ""]) and not is_dup
                conf_val = round(float(iss.confidence) * 100) if (iss.confidence and iss.confidence <= 1.0) else int(iss.confidence or 95)
                repair_method = iss.description or "Issue resolved"
                orig_val = iss.original_value if iss.original_value is not None else "NULL"
                new_val = iss.suggested_value
                matching_row = None

                if is_dup:
                    m = re.search(r'row\s+(\d+)', iss.description or '', re.IGNORECASE)
                    if m:
                        matching_row = int(m.group(1))
                        repair_method = f"Exact duplicate of Row #{matching_row} (Row #{matching_row} retained; Row #{iss.row_number} removed)"
                        orig_val = f"Duplicate of Row #{matching_row}"
                        new_val = f"Row removed (Row #{matching_row} kept)"
                    else:
                        repair_method = "Exact duplicate removed (Original record retained)"
                        new_val = "Row removed"

                rec = {
                    "id": iss.id,
                    "row_index": iss.row_number,
                    "row_number": iss.row_number,
                    "column_name": iss.column_name or "Entire Row",
                    "original_value": orig_val,
                    "new_value": new_val,
                    "change_type": "Duplicate Removal" if is_dup else ("Missing Imputation" if iss.issue_type == "missing_value" else "Format Normalization"),
                    "repair_method": repair_method,
                    "confidence": conf_val,
                    "status": "Accepted" if iss.status == "accepted" else "Auto-repaired",
                    "is_deletion": is_dup,
                    "is_addition": is_add,
                    "matching_row": matching_row,
                    "timestamp": None,
                }
                modified_records.append(rec)
                if is_dup:
                    deleted_rows.append(rec)

    # 3. Enhance preview records with highlighting flags
    orig_records = df_to_preview_records(orig_df, limit=250)
    cleaned_records = df_to_preview_records(cleaned_df, limit=250)

    deleted_row_map = {
        r["row_number"]: r for r in modified_records if r.get("is_deletion")
    }
    modified_cell_map = {}
    for r in modified_records:
        if not r.get("is_deletion") and r.get("column_name") and r.get("column_name") != "Entire Row":
            modified_cell_map[(r["row_number"], r["column_name"])] = r

    for idx, r in enumerate(orig_records):
        if idx in deleted_row_map:
            del_rec = deleted_row_map[idx]
            r["_is_deleted"] = True
            r["_deletion_info"] = del_rec.get("repair_method") or "Duplicate row removed"
            r["_matching_row"] = del_rec.get("matching_row")

        mod_cols = [col for (row_num, col) in modified_cell_map.keys() if row_num == idx]
        if mod_cols:
            r["_modified_columns"] = mod_cols

    for (orig_row, col), rec in modified_cell_map.items():
        del_count_before = sum(1 for d_idx in deleted_row_map.keys() if d_idx < orig_row)
        clean_row_idx = orig_row - del_count_before
        if 0 <= clean_row_idx < len(cleaned_records):
            if "_modified_columns" not in cleaned_records[clean_row_idx]:
                cleaned_records[clean_row_idx]["_modified_columns"] = []
            if col not in cleaned_records[clean_row_idx]["_modified_columns"]:
                cleaned_records[clean_row_idx]["_modified_columns"].append(col)

    # 4. Accurate Trust Quotient Status
    pending_reviews_count = sum(1 for i in all_issues if i.status == "detected")
    critical_unresolved = sum(
        1 for i in all_issues
        if i.status in ["detected", "rejected"] and (i.severity in ["high", "critical"] or i.issue_type in ["missing_value", "invalid_format", "anomaly"])
    )

    if dataset.status != "validated":
        trust_status = "Pending Remediation"
    elif remaining > 0 or critical_unresolved > 0:
        trust_status = "Partially Repaired — Manual Review Required"
    else:
        trust_status = "Ready for Production Ingestion"

    changes_summary = {
        "original_rows": len(orig_df),
        "cleaned_rows": len(cleaned_df),
        "rows_removed": rows_diff,
        "duplicates_removed": duplicates_fixed,
        "cells_modified": cells_modified,
        "total_repairs_applied": len(modified_records),
    }

    return CompareResponse(
        dataset_id=dataset_id,
        original_row_count=len(orig_df),
        cleaned_row_count=len(cleaned_df),
        original_columns=list(orig_df.columns),
        cleaned_columns=list(cleaned_df.columns),
        quality_score_before=score_before,
        quality_score_after=score_after,
        score_improvement=score_diff,
        total_issues_detected=total_detected,
        total_issues_fixed=total_fixed,
        remaining_issues=remaining,
        original_preview=orig_records,
        cleaned_preview=cleaned_records,
        changes_summary=changes_summary,
        issues_by_category_before=issues_by_category_before,
        issues_by_category_after=issues_by_category_after,
        category_comparison=category_comparison,
        modified_records=modified_records,
        deleted_rows=deleted_rows,
        validation_status=trust_status,
        validation_passed=(dataset.status == "validated"),
        pending_reviews_count=pending_reviews_count,
        critical_issues_count=critical_unresolved,
        trust_status=trust_status,
    )
