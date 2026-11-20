from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------
# Dataset Models
# ---------------------------------------------------------

class DatasetBase(BaseModel):
    filename: str
    original_filename: str
    total_rows: int = 0
    total_columns: int = 0
    file_size: int = 0
    status: str = "uploaded"
    quality_score_before: Optional[float] = None
    quality_score_after: Optional[float] = None


class DatasetSummary(DatasetBase):
    id: str
    upload_date: datetime
    error_count: int = 0
    open_issues_count: int = 0
    repaired_issues_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class DatasetPreviewResponse(BaseModel):
    dataset: DatasetSummary
    preview_rows: List[Dict[str, Any]]
    total_rows: int
    total_columns: int
    is_cleaned: bool = False


# ---------------------------------------------------------
# Issue Models
# ---------------------------------------------------------

class IssueBase(BaseModel):
    issue_type: str
    column_name: Optional[str] = None
    row_number: int
    original_value: Optional[str] = None
    suggested_value: Optional[str] = None
    description: str
    severity: str = "medium"
    confidence: float = 1.0
    status: str = "detected"
    explanation: Optional[str] = None


class IssueResponse(IssueBase):
    id: str
    dataset_id: str

    model_config = ConfigDict(from_attributes=True)


class IssueListResponse(BaseModel):
    dataset_id: str
    total_count: int
    by_type: Dict[str, int]
    by_severity: Dict[str, int]
    issues: List[IssueResponse]


# ---------------------------------------------------------
# Profiler Models
# ---------------------------------------------------------

class ColumnProfile(BaseModel):
    name: str
    data_type: str
    missing_count: int
    missing_percentage: float
    unique_count: int
    unique_percentage: float
    sample_values: List[Any]
    stats: Optional[Dict[str, Any]] = None


class ProfileResponse(BaseModel):
    dataset_id: str
    total_rows: int
    total_columns: int
    columns: List[ColumnProfile]


# ---------------------------------------------------------
# Analysis Models
# ---------------------------------------------------------

class AnalyzeResponse(BaseModel):
    dataset_id: str
    status: str
    quality_score_before: float
    total_issues: int
    issues_summary: Dict[str, int]
    score_breakdown: Optional[Dict[str, Any]] = None
    calculation_explanation: Optional[str] = None
    message: str


# ---------------------------------------------------------
# Repair & Validation Models
# ---------------------------------------------------------

class RepairActionResponse(BaseModel):
    success: bool
    dataset_id: str
    issue_id: str
    action: str  # accepted, rejected
    message: str
    quality_score_after: Optional[float] = None


class AutoRepairResponse(BaseModel):
    success: bool
    dataset_id: str
    repaired_count: int
    remaining_issues: int
    quality_score_before: Optional[float] = None
    quality_score_after: Optional[float] = None
    message: str


class ValidationDetail(BaseModel):
    check_name: str
    passed: bool
    message: str


class ValidationResponse(BaseModel):
    dataset_id: str
    structure_matches: bool
    original_row_count: int
    cleaned_row_count: int
    row_count_difference: int
    row_count_explanation: str
    remaining_issues_count: int
    validation_passed: bool
    quality_score_after: Optional[float] = None
    details: List[ValidationDetail]


class CompareResponse(BaseModel):
    dataset_id: str
    original_row_count: int
    cleaned_row_count: int
    original_columns: List[str]
    cleaned_columns: List[str]
    quality_score_before: Optional[float] = None
    quality_score_after: Optional[float] = None
    score_improvement: Optional[float] = None
    total_issues_detected: int
    total_issues_fixed: int
    remaining_issues: int
    original_preview: List[Dict[str, Any]] = []
    cleaned_preview: List[Dict[str, Any]] = []
    changes_summary: Dict[str, Any] = {}
    issues_by_category_before: Optional[Dict[str, int]] = None
    issues_by_category_after: Optional[Dict[str, int]] = None
    category_comparison: Optional[List[Dict[str, Any]]] = None
    modified_records: Optional[List[Dict[str, Any]]] = None
    deleted_rows: Optional[List[Dict[str, Any]]] = None
    validation_status: Optional[str] = None
    validation_passed: Optional[bool] = False
    pending_reviews_count: Optional[int] = 0
    critical_issues_count: Optional[int] = 0
    trust_status: Optional[str] = None
    validation_passed: bool = False


# ---------------------------------------------------------
# Audit Models
# ---------------------------------------------------------

class AuditLogResponse(BaseModel):
    id: str
    dataset_id: str
    column_name: Optional[str] = None
    row_number: Optional[int] = None
    original_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: str
    confidence: float
    timestamp: datetime
    user_decision: str
    issue_type: str

    model_config = ConfigDict(from_attributes=True)


class AuditSummaryResponse(BaseModel):
    dataset_id: str
    total_actions: int
    by_decision: Dict[str, int]
    by_issue_type: Dict[str, int]
    logs: List[AuditLogResponse]


# ---------------------------------------------------------
# Dashboard Stats Model
# ---------------------------------------------------------

class StatsResponse(BaseModel):
    total_datasets: int
    total_errors: int = 0
    total_errors_detected: int = 0
    open_issues: int = 0
    accepted_repairs: int = 0
    rejected_suggestions: int = 0
    pending_reviews: int = 0
    successfully_validated_repairs: int = 0
    errors_repaired: int = 0
    avg_quality_score: float = 100.0
    average_quality_score: float = 100.0
    recent_quality_trend: List[Dict[str, Any]] = []
    error_distribution: List[Dict[str, Any]] = []
