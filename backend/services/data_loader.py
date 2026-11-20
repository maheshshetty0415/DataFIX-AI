import os
import glob
import uuid
import shutil
from typing import Optional, Tuple, List, Dict, Any
import pandas as pd
import numpy as np
from fastapi import UploadFile, HTTPException

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
CLEANED_DIR = os.path.join(BASE_DIR, "cleaned")

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(CLEANED_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def validate_file_extension(filename: str) -> str:
    """Validate that the file extension is supported."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    return ext


async def save_uploaded_file(file: UploadFile) -> Tuple[str, str, int, str]:
    """
    Save an uploaded file to the uploads directory.
    Returns: (dataset_id, stored_filepath, file_size, safe_original_filename)
    """
    original_filename = file.filename or "uploaded_data.csv"
    ext = validate_file_extension(original_filename)
    dataset_id = str(uuid.uuid4())
    safe_name = "".join(c for c in original_filename if c.isalnum() or c in "._- ")
    stored_filename = f"{dataset_id}_{safe_name}"
    stored_path = os.path.join(UPLOADS_DIR, stored_filename)

    file_size = 0
    with open(stored_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            file_size += len(chunk)
            buffer.write(chunk)

    return dataset_id, stored_path, file_size, original_filename


def save_file_from_path(src_path: str, original_filename: str) -> Tuple[str, str, int]:
    """
    Copy a local file (e.g., sample data) to the uploads directory.
    Returns: (dataset_id, stored_filepath, file_size)
    """
    validate_file_extension(original_filename)
    dataset_id = str(uuid.uuid4())
    safe_name = "".join(c for c in original_filename if c.isalnum() or c in "._- ")
    stored_filename = f"{dataset_id}_{safe_name}"
    stored_path = os.path.join(UPLOADS_DIR, stored_filename)

    shutil.copyfile(src_path, stored_path)
    file_size = os.path.getsize(stored_path)
    return dataset_id, stored_path, file_size


def load_file_as_df(file_path: str) -> pd.DataFrame:
    """Load a CSV or Excel file into a pandas DataFrame with encoding fallback."""
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".csv":
        encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252", "iso-8859-1"]
        for encoding in encodings:
            try:
                df = pd.read_csv(file_path, encoding=encoding)
                return df
            except (UnicodeDecodeError, pd.errors.ParserError):
                continue
        # Fallback to python engine with automatic separator detection
        try:
            df = pd.read_csv(file_path, engine="python", on_bad_lines="skip")
            return df
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Unable to parse CSV file with supported encodings.")
    elif ext in [".xlsx", ".xls"]:
        try:
            df = pd.read_excel(file_path)
            return df
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")


def get_dataset_file_path(dataset_id: str, is_cleaned: bool = False) -> Optional[str]:
    """Find the path of original or cleaned file for the dataset."""
    target_dir = CLEANED_DIR if is_cleaned else UPLOADS_DIR
    pattern = os.path.join(target_dir, f"{dataset_id}*")
    matches = glob.glob(pattern)
    if matches:
        return matches[0]
    return None


def load_dataset_df(dataset_id: str, is_cleaned: bool = False) -> pd.DataFrame:
    """Load original or cleaned dataset dataframe by dataset ID."""
    file_path = get_dataset_file_path(dataset_id, is_cleaned=is_cleaned)
    if not file_path or not os.path.exists(file_path):
        if is_cleaned:
            # Fall back to original if cleaned does not exist yet
            file_path = get_dataset_file_path(dataset_id, is_cleaned=False)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Dataset file for id '{dataset_id}' not found.")

    return load_file_as_df(file_path)


def save_cleaned_df(dataset_id: str, df: pd.DataFrame) -> str:
    """Save cleaned dataframe as CSV in the cleaned directory."""
    cleaned_path = os.path.join(CLEANED_DIR, f"{dataset_id}_cleaned.csv")
    df.to_csv(cleaned_path, index=False)
    return cleaned_path


def df_to_preview_records(df: pd.DataFrame, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
    """Convert dataframe slice to JSON-serializable list of dicts with NaN replaced by None."""
    head_df = df.iloc[offset:offset + limit].copy()
    head_df = head_df.replace({np.nan: None, np.inf: None, -np.inf: None})

    # Convert datetimes and complex objects to strings
    for col in head_df.columns:
        if pd.api.types.is_datetime64_any_dtype(head_df[col]):
            head_df[col] = head_df[col].astype(str)

    records = head_df.to_dict(orient="records")
    # Clean records to guarantee JSON compatibility
    clean_records = []
    for row in records:
        clean_row = {}
        for k, v in row.items():
            if pd.isna(v) or v is None:
                clean_row[str(k)] = None
            else:
                clean_row[str(k)] = v
        clean_records.append(clean_row)
    return clean_records


def delete_dataset_files(dataset_id: str) -> List[str]:
    """
    Safely delete all physical files associated with a dataset from designated storage directories:
    - Original uploaded file in UPLOADS_DIR
    - Cleaned working file in CLEANED_DIR
    - Any temporary or exported report files
    
    Security: Strictly resolves within allowed directories, prevents path traversal, and handles missing files gracefully.
    """
    deleted_files: List[str] = []
    # Sanitize dataset_id to strictly permit alphanumeric, hyphens, and underscores (e.g. UUID)
    safe_id = "".join(c for c in dataset_id if c.isalnum() or c in "-_")
    if not safe_id:
        return deleted_files

    target_directories = [UPLOADS_DIR, CLEANED_DIR]
    reports_dir = os.path.join(BASE_DIR, "reports")
    if os.path.exists(reports_dir):
        target_directories.append(reports_dir)

    for directory in target_directories:
        if not os.path.exists(directory):
            continue
        canonical_dir = os.path.realpath(directory)
        pattern = os.path.join(directory, f"{safe_id}*")
        for match in glob.glob(pattern):
            canonical_file = os.path.realpath(match)
            # Guarantee path cannot escape the designated directory
            if canonical_file.startswith(canonical_dir) and os.path.isfile(canonical_file):
                try:
                    os.remove(canonical_file)
                    deleted_files.append(os.path.basename(canonical_file))
                except OSError:
                    pass

    return deleted_files
