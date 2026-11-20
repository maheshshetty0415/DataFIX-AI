import os
from typing import Dict, Any, Optional, List
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from fastapi import HTTPException

from backend.database import Dataset, Issue, AuditLog
from backend.services.data_loader import (
    load_dataset_df,
    save_cleaned_df,
    get_dataset_file_path,
)
from backend.services.audit import record_action
from backend.services.quality_score import calculate_quality_score
from backend.services.error_detector import is_personal_or_id_column


def get_working_cleaned_df(dataset_id: str) -> pd.DataFrame:
    """
    Get the cleaned DataFrame if it exists; otherwise make a fresh copy
    from the original dataset without modifying the original file.
    """
    cleaned_path = get_dataset_file_path(dataset_id, is_cleaned=True)
    if cleaned_path and os.path.exists(cleaned_path):
        return load_dataset_df(dataset_id, is_cleaned=True)
    
    # Load original and save as starting point for cleaned
    orig_df = load_dataset_df(dataset_id, is_cleaned=False)
    cleaned_copy = orig_df.copy(deep=True)
    save_cleaned_df(dataset_id, cleaned_copy)
    return cleaned_copy


def recalculate_dataset_score(db: Session, dataset: Dataset) -> float:
    """Recalculate quality_score_after based on remaining unresolved issues."""
    active_issues = (
        db.query(Issue)
        .filter(Issue.dataset_id == dataset.id, Issue.status.in_(["detected", "rejected"]))
        .all()
    )
    score = calculate_quality_score(
        issues=active_issues,
        total_rows=dataset.total_rows,
        total_columns=dataset.total_columns
    )
    dataset.quality_score_after = score
    db.commit()
    return score


def accept_repair(db: Session, dataset_id: str, issue_id: str) -> Dict[str, Any]:
    """
    Apply a single repair to the cleaned dataset copy.
    Ensures idempotency and prevents applying unsafe/fabricated repairs.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    issue = db.query(Issue).filter(Issue.id == issue_id, Issue.dataset_id == dataset_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Idempotency check: if already accepted or auto_fixed, return immediately
    if issue.status in ["accepted", "auto_fixed"]:
        return {
            "success": True,
            "dataset_id": dataset_id,
            "issue_id": issue_id,
            "action": issue.status,
            "message": f"Issue {issue_id} is already repaired (idempotent).",
            "quality_score_after": dataset.quality_score_after,
        }

    # Strict protection against fabricated repairs and unverified outliers
    if not issue.suggested_value or \
       "Cannot safely reconstruct" in issue.suggested_value or \
       issue.suggested_value.startswith("Needs manual review") or \
       issue.suggested_value.startswith("Flagged for review"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot automatically apply repair for suggestion: '{issue.suggested_value}'. Manual verification required."
        )

    df = get_working_cleaned_df(dataset_id)
    col = issue.column_name
    row_num = issue.row_number
    applied = False
    new_val = issue.suggested_value

    if issue.issue_type == "duplicate":
        # Remove duplicate row
        if row_num in df.index:
            df = df.drop(index=row_num).reset_index(drop=True)
            applied = True
            new_val = "Row removed"
        else:
            # Check if row was already dropped (idempotent)
            df = df.drop_duplicates(keep="first").reset_index(drop=True)
            applied = True
            new_val = "Row removed"
    elif col and col in df.columns:
        if row_num in df.index:
            # Cast suggested value to column dtype if appropriate
            val_to_set: Any = issue.suggested_value
            if pd.api.types.is_integer_dtype(df[col]):
                try:
                    val_to_set = int(float(issue.suggested_value))
                except (ValueError, TypeError):
                    pass
            elif pd.api.types.is_float_dtype(df[col]):
                try:
                    val_to_set = float(issue.suggested_value)
                except (ValueError, TypeError):
                    pass

            df.at[row_num, col] = val_to_set
            applied = True
        else:
            # Row index might have shifted if duplicates were removed earlier
            applied = False

    if applied:
        save_cleaned_df(dataset_id, df)
        issue.status = "accepted"
        db.commit()

        # Check if identical audit log already recorded (idempotent logging)
        existing_log = db.query(AuditLog).filter(
            AuditLog.dataset_id == dataset_id,
            AuditLog.column_name == issue.column_name,
            AuditLog.row_number == issue.row_number,
            AuditLog.user_decision == "accepted"
        ).first()

        if not existing_log:
            record_action(
                db=db,
                dataset_id=dataset_id,
                column_name=issue.column_name,
                row_number=issue.row_number,
                original_value=issue.original_value,
                new_value=str(new_val),
                reason=issue.description,
                confidence=issue.confidence,
                user_decision="accepted",
                issue_type=issue.issue_type,
            )

        dataset.status = "repaired"
        new_score = recalculate_dataset_score(db, dataset)

        return {
            "success": True,
            "dataset_id": dataset_id,
            "issue_id": issue_id,
            "action": "accepted",
            "message": f"Successfully applied repair for issue {issue_id}",
            "quality_score_after": new_score,
        }
    else:
        raise HTTPException(
            status_code=400,
            detail="Failed to apply repair: target row or column not available in working copy."
        )


def reject_repair(db: Session, dataset_id: str, issue_id: str) -> Dict[str, Any]:
    """Mark an issue as rejected without modifying the cleaned dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    issue = db.query(Issue).filter(Issue.id == issue_id, Issue.dataset_id == dataset_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.status == "rejected":
        return {
            "success": True,
            "dataset_id": dataset_id,
            "issue_id": issue_id,
            "action": "rejected",
            "message": f"Issue {issue_id} is already marked as rejected (idempotent).",
            "quality_score_after": dataset.quality_score_after,
        }

    issue.status = "rejected"
    db.commit()

    record_action(
        db=db,
        dataset_id=dataset_id,
        column_name=issue.column_name,
        row_number=issue.row_number,
        original_value=issue.original_value,
        new_value=issue.original_value,
        reason=f"Rejected: {issue.description}",
        confidence=issue.confidence,
        user_decision="rejected",
        issue_type=issue.issue_type,
    )

    new_score = recalculate_dataset_score(db, dataset)

    return {
        "success": True,
        "dataset_id": dataset_id,
        "issue_id": issue_id,
        "action": "rejected",
        "message": f"Issue {issue_id} marked as rejected.",
        "quality_score_after": new_score,
    }


def auto_repair(db: Session, dataset_id: str) -> Dict[str, Any]:
    """
    Apply safe repairs automatically:
    1. Whitespace trimming & casing standardization
    2. Missing value imputation strictly for non-personal, non-ID columns
    3. Duplicate removal
    
    SAFETY CONSTRAINTS:
    - Never fabricates missing personal information (emails, phones, IDs, names).
    - Never automatically modifies statistical anomalies or outliers.
    - Idempotent: repeating auto-repair leaves dataset consistently clean without duplication.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Get or initialize the working cleaned dataset copy
    df = get_working_cleaned_df(dataset_id)

    issues = db.query(Issue).filter(Issue.dataset_id == dataset_id).all()
    repaired_count = 0

    # 1. Whitespace trimming & casing standardization on string columns
    for issue in issues:
        if issue.status == "detected" and issue.issue_type == "inconsistency" and issue.column_name and issue.column_name in df.columns:
            row_idx = issue.row_number
            if row_idx in df.index and issue.suggested_value:
                df.at[row_idx, issue.column_name] = issue.suggested_value
                issue.status = "auto_fixed"
                repaired_count += 1
                existing_log = db.query(AuditLog).filter(
                    AuditLog.dataset_id == dataset_id,
                    AuditLog.column_name == issue.column_name,
                    AuditLog.row_number == row_idx,
                    AuditLog.user_decision == "auto"
                ).first()
                if not existing_log:
                    record_action(
                        db=db,
                        dataset_id=dataset_id,
                        column_name=issue.column_name,
                        row_number=row_idx,
                        original_value=issue.original_value,
                        new_value=issue.suggested_value,
                        reason=f"Auto-fixed inconsistency: {issue.description}",
                        confidence=issue.confidence,
                        user_decision="auto",
                        issue_type=issue.issue_type,
                    )

    # 2. Missing value imputation for non-personal, non-ID columns
    for issue in issues:
        if issue.status == "detected" and issue.issue_type == "missing_value":
            col = issue.column_name
            # Strictly verify NOT personal or identifier data
            if col and not is_personal_or_id_column(col) and issue.suggested_value:
                if "Cannot safely reconstruct" not in issue.suggested_value:
                    row_idx = issue.row_number
                    if row_idx in df.index:
                        val_to_set: Any = issue.suggested_value
                        if pd.api.types.is_integer_dtype(df[col]):
                            try:
                                val_to_set = int(float(issue.suggested_value))
                            except (ValueError, TypeError):
                                pass
                        elif pd.api.types.is_float_dtype(df[col]):
                            try:
                                val_to_set = float(issue.suggested_value)
                            except (ValueError, TypeError):
                                pass

                        df.at[row_idx, col] = val_to_set
                        issue.status = "auto_fixed"
                        repaired_count += 1
                        existing_log = db.query(AuditLog).filter(
                            AuditLog.dataset_id == dataset_id,
                            AuditLog.column_name == col,
                            AuditLog.row_number == row_idx,
                            AuditLog.user_decision == "auto"
                        ).first()
                        if not existing_log:
                            record_action(
                                db=db,
                                dataset_id=dataset_id,
                                column_name=col,
                                row_number=row_idx,
                                original_value=issue.original_value,
                                new_value=str(val_to_set),
                                reason=f"Auto-imputed missing value: {issue.description}",
                                confidence=issue.confidence,
                                user_decision="auto",
                                issue_type=issue.issue_type,
                            )

    # 3. Duplicate removal (exact duplicates only)
    dup_issues = [iss for iss in issues if iss.status == "detected" and iss.issue_type == "duplicate" and iss.suggested_value == "Remove duplicate row"]
    if dup_issues:
        rows_before = len(df)
        df = df.drop_duplicates(keep="first").reset_index(drop=True)
        for issue in dup_issues:
            issue.status = "auto_fixed"
            repaired_count += 1
            existing_log = db.query(AuditLog).filter(
                AuditLog.dataset_id == dataset_id,
                AuditLog.column_name == None,
                AuditLog.row_number == issue.row_number,
                AuditLog.user_decision == "auto"
            ).first()
            if not existing_log:
                record_action(
                    db=db,
                    dataset_id=dataset_id,
                    column_name=None,
                    row_number=issue.row_number,
                    original_value=issue.original_value,
                    new_value="Row removed",
                    reason=f"Auto-removed duplicate row: {issue.description}",
                    confidence=issue.confidence,
                    user_decision="auto",
                    issue_type=issue.issue_type,
                )

    save_cleaned_df(dataset_id, df)
    dataset.status = "repaired"
    db.commit()

    new_score = recalculate_dataset_score(db, dataset)
    remaining_count = (
        db.query(Issue)
        .filter(Issue.dataset_id == dataset_id, Issue.status.in_(["detected", "rejected"]))
        .count()
    )

    return {
        "success": True,
        "dataset_id": dataset_id,
        "repaired_count": repaired_count,
        "remaining_issues": remaining_count,
        "quality_score_before": dataset.quality_score_before,
        "quality_score_after": new_score,
        "message": f"Auto-repair completed: {repaired_count} safe issues repaired, {remaining_count} issues remain for manual review.",
    }
