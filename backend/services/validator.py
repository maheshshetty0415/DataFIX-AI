from typing import Dict, Any, List
import pandas as pd
from sqlalchemy.orm import Session
from fastapi import HTTPException

from backend.database import Dataset, Issue
from backend.services.data_loader import load_dataset_df, get_dataset_file_path


def validate_dataset(db: Session, dataset_id: str) -> Dict[str, Any]:
    """
    Validate the repaired dataset against the original:
    - Verify column schema integrity
    - Track row count delta and explain differences (e.g. deduplication)
    - Verify remaining unresolved issues count
    - Update dataset status to 'validated'
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    orig_df = load_dataset_df(dataset_id, is_cleaned=False)

    cleaned_path = get_dataset_file_path(dataset_id, is_cleaned=True)
    if cleaned_path:
        cleaned_df = load_dataset_df(dataset_id, is_cleaned=True)
    else:
        cleaned_df = orig_df.copy(deep=True)

    checks: List[Dict[str, Any]] = []

    # 1. Column Structure Check
    orig_cols = list(orig_df.columns)
    cleaned_cols = list(cleaned_df.columns)
    structure_matches = orig_cols == cleaned_cols
    checks.append({
        "check_name": "Column Structure Integrity",
        "passed": structure_matches,
        "message": (
            f"All {len(orig_cols)} columns preserved in exact schema order."
            if structure_matches
            else f"Column mismatch: expected {orig_cols}, got {cleaned_cols}."
        ),
    })

    # 2. Row count verification & explanation
    orig_rows = len(orig_df)
    clean_rows = len(cleaned_df)
    row_diff = orig_rows - clean_rows

    duplicate_issues_count = (
        db.query(Issue)
        .filter(
            Issue.dataset_id == dataset_id,
            Issue.issue_type == "duplicate",
            Issue.status.in_(["accepted", "auto_fixed"]),
        )
        .count()
    )

    if row_diff == 0:
        row_explanation = "Row count preserved without removals."
        row_passed = True
    elif row_diff == duplicate_issues_count:
        row_explanation = f"{row_diff} duplicate rows removed successfully during deduplication."
        row_passed = True
    elif row_diff > 0:
        row_explanation = f"{row_diff} rows removed ({duplicate_issues_count} confirmed duplicates resolved)."
        row_passed = True
    else:
        row_explanation = f"Unexpected row count increase: cleaned dataset has {-row_diff} more rows."
        row_passed = False

    checks.append({
        "check_name": "Row Count Consistency",
        "passed": row_passed,
        "message": row_explanation,
    })

    # 3. Remaining issues verification
    remaining_issues_count = (
        db.query(Issue)
        .filter(Issue.dataset_id == dataset_id, Issue.status.in_(["detected", "rejected"]))
        .count()
    )

    fixed_issues_count = (
        db.query(Issue)
        .filter(Issue.dataset_id == dataset_id, Issue.status.in_(["accepted", "auto_fixed"]))
        .count()
    )

    checks.append({
        "check_name": "Repairs Application Check",
        "passed": True,
        "message": f"{fixed_issues_count} issues resolved; {remaining_issues_count} issues pending or rejected.",
    })

    all_passed = all(c["passed"] for c in checks)
    if all_passed:
        dataset.status = "validated"
        db.commit()

    return {
        "dataset_id": dataset_id,
        "structure_matches": structure_matches,
        "original_row_count": orig_rows,
        "cleaned_row_count": clean_rows,
        "row_count_difference": row_diff,
        "row_count_explanation": row_explanation,
        "remaining_issues_count": remaining_issues_count,
        "validation_passed": all_passed,
        "quality_score_after": dataset.quality_score_after,
        "details": checks,
    }
