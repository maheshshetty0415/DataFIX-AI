import os
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from backend.database import get_db, Dataset, Issue, AuditLog
from backend.models import DatasetSummary, DatasetPreviewResponse
from backend.services.data_loader import (
    save_uploaded_file,
    save_file_from_path,
    load_file_as_df,
    load_dataset_df,
    df_to_preview_records,
    delete_dataset_files,
)

router = APIRouter(prefix="/api", tags=["Datasets"])

SAMPLE_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "sample_data",
    "sample_customers.csv"
)


@router.post("/upload", response_model=DatasetPreviewResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a dataset (CSV, XLSX, XLS), analyze dimensions, and store initial record.
    Returns dataset metadata and the first 20 rows preview.
    """
    dataset_id, stored_path, file_size, orig_name = await save_uploaded_file(file)

    try:
        df = load_file_as_df(stored_path)
    except Exception as e:
        delete_dataset_files(dataset_id)
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e)}")

    total_rows = len(df)
    total_cols = len(df.columns)

    dataset = Dataset(
        id=dataset_id,
        filename=os.path.basename(stored_path),
        original_filename=orig_name,
        total_rows=total_rows,
        total_columns=total_cols,
        file_size=file_size,
        status="uploaded",
        quality_score_before=None,
        quality_score_after=None,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    preview_rows = df_to_preview_records(df, limit=20)

    return DatasetPreviewResponse(
        dataset=DatasetSummary.model_validate(dataset),
        preview_rows=preview_rows,
        total_rows=total_rows,
        total_columns=total_cols,
        is_cleaned=False,
    )


@router.get("/datasets", response_model=List[DatasetSummary])
def list_datasets(db: Session = Depends(get_db)):
    """List all registered datasets sorted by most recent upload with real issue counts."""
    datasets = db.query(Dataset).order_by(Dataset.upload_date.desc()).all()

    # Efficiently aggregate issue metrics per dataset
    stats = (
        db.query(
            Issue.dataset_id,
            func.count(Issue.id).label("total_errors"),
            func.sum(case((Issue.status == "detected", 1), else_=0)).label("open_issues"),
            func.sum(case((Issue.status.in_(["accepted", "auto_fixed"]), 1), else_=0)).label("repaired_issues")
        )
        .group_by(Issue.dataset_id)
        .all()
    )
    stat_map = {
        s.dataset_id: {
            "total": s.total_errors or 0,
            "open": s.open_issues or 0,
            "repaired": s.repaired_issues or 0,
        }
        for s in stats
    }

    result = []
    for d in datasets:
        ds_stats = stat_map.get(d.id, {"total": 0, "open": 0, "repaired": 0})
        item = DatasetSummary(
            id=d.id,
            filename=d.filename,
            original_filename=d.original_filename,
            upload_date=d.upload_date,
            total_rows=d.total_rows,
            total_columns=d.total_columns,
            file_size=d.file_size,
            status=d.status,
            quality_score_before=d.quality_score_before,
            quality_score_after=d.quality_score_after,
            error_count=ds_stats["total"],
            open_issues_count=ds_stats["open"],
            repaired_issues_count=ds_stats["repaired"],
        )
        result.append(item)
    return result


@router.get("/datasets/{dataset_id}", response_model=DatasetPreviewResponse)
def get_dataset_details(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Get dataset details with current data preview (cleaned if available, else original)."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    is_cleaned = dataset.status in ["repaired", "validated"]
    try:
        df = load_dataset_df(dataset_id, is_cleaned=is_cleaned)
    except Exception:
        df = load_dataset_df(dataset_id, is_cleaned=False)
        is_cleaned = False

    preview_rows = df_to_preview_records(df, limit=20)
    return DatasetPreviewResponse(
        dataset=DatasetSummary.model_validate(dataset),
        preview_rows=preview_rows,
        total_rows=len(df),
        total_columns=len(df.columns),
        is_cleaned=is_cleaned,
    )


@router.get("/datasets/{dataset_id}/preview")
def get_dataset_preview(
    dataset_id: str,
    cleaned: bool = Query(False, description="Whether to preview cleaned version if available"),
    limit: int = Query(250, ge=1, le=1000, description="Max rows to return"),
    offset: int = Query(0, ge=0, description="Row offset for pagination"),
    db: Session = Depends(get_db)
):
    """Get the first N rows of original or cleaned dataset with offset support."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = load_dataset_df(dataset_id, is_cleaned=cleaned)
    preview = df_to_preview_records(df, limit=limit, offset=offset)

    return {
        "dataset_id": dataset_id,
        "is_cleaned": cleaned,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": list(df.columns),
        "preview_rows": preview,
        "offset": offset,
        "limit": limit,
    }


@router.post("/datasets/sample", response_model=DatasetPreviewResponse)
def load_sample_dataset(db: Session = Depends(get_db)):
    """Load the built-in sample customer dataset containing intentional data quality errors."""
    if not os.path.exists(SAMPLE_FILE_PATH):
        raise HTTPException(status_code=404, detail="Sample dataset file not found on server.")

    dataset_id, stored_path, file_size = save_file_from_path(SAMPLE_FILE_PATH, "sample_customers.csv")
    df = load_file_as_df(stored_path)

    dataset = Dataset(
        id=dataset_id,
        filename=os.path.basename(stored_path),
        original_filename="sample_customers.csv",
        total_rows=len(df),
        total_columns=len(df.columns),
        file_size=file_size,
        status="uploaded",
        quality_score_before=None,
        quality_score_after=None,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    preview_rows = df_to_preview_records(df, limit=20)
    return DatasetPreviewResponse(
        dataset=DatasetSummary.model_validate(dataset),
        preview_rows=preview_rows,
        total_rows=len(df),
        total_columns=len(df.columns),
        is_cleaned=False,
    )


@router.delete("/datasets/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """
    Permanently delete a dataset and all associated data:
    1. Verify dataset exists.
    2. Identify and safely delete physical files (original upload, cleaned dataset, exports).
    3. Explicitly delete associated Issue records to prevent orphaned rows.
    4. Explicitly delete associated AuditLog records to prevent orphaned rows.
    5. Delete the Dataset metadata record.
    6. Safely commit the database transaction.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset with ID '{dataset_id}' not found.")

    filename = dataset.original_filename or dataset.filename

    # 1. Identify and delete all associated files from storage
    deleted_files = delete_dataset_files(dataset_id)

    # 2. Explicitly delete associated Issue records
    deleted_issues_count = db.query(Issue).filter(Issue.dataset_id == dataset_id).delete(synchronize_session=False)

    # 3. Explicitly delete associated AuditLog records
    deleted_audit_count = db.query(AuditLog).filter(AuditLog.dataset_id == dataset_id).delete(synchronize_session=False)

    # 4. Delete dataset metadata record
    db.delete(dataset)

    # 5. Safely commit transaction
    db.commit()

    return {
        "success": True,
        "dataset_id": dataset_id,
        "filename": filename,
        "deleted_issues_count": deleted_issues_count,
        "deleted_audit_count": deleted_audit_count,
        "deleted_files": deleted_files,
        "message": f"Dataset '{filename}' and all associated records permanently deleted."
    }
