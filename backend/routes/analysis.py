from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db, Dataset, Issue
from backend.models import (
    AnalyzeResponse,
    IssueListResponse,
    IssueResponse,
    ProfileResponse,
)
from backend.services.data_loader import load_dataset_df
from backend.services.profiler import profile_dataset
from backend.services.error_detector import detect_issues
from backend.services.quality_score import calculate_quality_score, get_score_breakdown

router = APIRouter(prefix="/api", tags=["Analysis"])


@router.post("/analyze/{dataset_id}", response_model=AnalyzeResponse)
def analyze_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """
    Run full data quality inspection:
    - Scans for missing values, duplicates, invalid formats, inconsistencies, and anomalies
    - Computes initial data quality score (0-100)
    - Persists detected issues in the database
    - Updates dataset status to 'analyzed'
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset.status = "analyzing"
    db.commit()

    # Load original dataset
    df = load_dataset_df(dataset_id, is_cleaned=False)

    # Clear previous issues if re-analyzing
    db.query(Issue).filter(Issue.dataset_id == dataset_id).delete()
    db.commit()

    # Detect issues
    raw_issues = detect_issues(df, dataset_id=dataset_id)

    db_issues = []
    summary_by_type: Dict[str, int] = {}
    for item in raw_issues:
        itype = item["issue_type"]
        summary_by_type[itype] = summary_by_type.get(itype, 0) + 1

        issue_obj = Issue(
            dataset_id=dataset_id,
            issue_type=item["issue_type"],
            column_name=item["column_name"],
            row_number=item["row_number"],
            original_value=item["original_value"],
            suggested_value=item["suggested_value"],
            description=item["description"],
            severity=item["severity"],
            confidence=item["confidence"],
            status="detected",
            explanation=item.get("explanation"),
        )
        db_issues.append(issue_obj)

    db.add_all(db_issues)
    db.commit()

    # Compute quality score & explanation
    score_details = get_score_breakdown(raw_issues, len(df), len(df.columns))
    score = score_details["score"]
    dataset.quality_score_before = score
    dataset.quality_score_after = score
    dataset.status = "analyzed"
    dataset.total_rows = len(df)
    dataset.total_columns = len(df.columns)
    db.commit()

    return AnalyzeResponse(
        dataset_id=dataset_id,
        status="analyzed",
        quality_score_before=score,
        total_issues=len(raw_issues),
        issues_summary=summary_by_type,
        score_breakdown=score_details,
        calculation_explanation=score_details["calculation_explanation"],
        message=f"Analysis complete: found {len(raw_issues)} quality issues across {len(df)} rows.",
    )


@router.get("/issues/{dataset_id}", response_model=IssueListResponse)
def get_dataset_issues(
    dataset_id: str,
    type: Optional[str] = Query(None, description="Filter by issue_type (e.g., missing_value, duplicate)"),
    status: Optional[str] = Query(None, description="Filter by issue status (detected, accepted, rejected, auto_fixed)"),
    severity: Optional[str] = Query(None, description="Filter by severity (low, medium, high, critical)"),
    db: Session = Depends(get_db)
):
    """Retrieve all detected issues for a dataset with optional filtering."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    query = db.query(Issue).filter(Issue.dataset_id == dataset_id)
    if type:
        query = query.filter(Issue.issue_type == type)
    if status:
        query = query.filter(Issue.status == status)
    if severity:
        query = query.filter(Issue.severity == severity)

    issues = query.order_by(Issue.row_number.asc()).all()

    # Compute summary aggregates across all issues for this dataset
    all_issues = db.query(Issue).filter(Issue.dataset_id == dataset_id).all()
    by_type: Dict[str, int] = {}
    by_severity: Dict[str, int] = {}

    for iss in all_issues:
        by_type[iss.issue_type] = by_type.get(iss.issue_type, 0) + 1
        by_severity[iss.severity] = by_severity.get(iss.severity, 0) + 1

    return IssueListResponse(
        dataset_id=dataset_id,
        total_count=len(issues),
        by_type=by_type,
        by_severity=by_severity,
        issues=[IssueResponse.model_validate(i) for i in issues],
    )


@router.get("/profile/{dataset_id}", response_model=ProfileResponse)
def get_dataset_profile(
    dataset_id: str,
    cleaned: bool = Query(False, description="Profile cleaned dataset if available"),
    db: Session = Depends(get_db)
):
    """Get statistical and structural profile of the dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataset_df(dataset_id, is_cleaned=cleaned)
    profile_data = profile_dataset(df, dataset_id=dataset_id)
    return ProfileResponse(**profile_data)
