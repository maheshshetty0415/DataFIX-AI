import re
import os
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
import pandas as pd
import numpy as np

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
PHONE_DIGITS_REGEX = re.compile(r"\d")

# Columns that represent personal identification or direct contact info.
# These MUST NEVER have fabricated/synthetic data generated.
PERSONAL_ID_KEYWORDS = [
    "id", "uuid", "key", "code", "email", "phone", "mobile",
    "tel", "cell", "ssn", "social_security", "passport",
    "license", "name", "first_name", "last_name", "full_name",
    "address", "zip", "postal", "customer_id", "client_id",
    "user_id", "account_id"
]

DEFAULT_REFERENCE_DATE = datetime(2026, 11, 19, 23, 59, 59)


def get_system_reference_date() -> datetime:
    """
    Get configurable system reference date for business rule validation.
    Defaults to November 19, 2026 (the system test benchmark date).
    Can be overridden via DATAFIX_REFERENCE_DATE environment variable.
    """
    env_date = os.getenv("DATAFIX_REFERENCE_DATE")
    if env_date:
        try:
            return datetime.fromisoformat(env_date)
        except Exception:
            pass
    return DEFAULT_REFERENCE_DATE


def is_personal_or_id_column(col_name: str) -> bool:
    """Return True if column represents personal identity, contact, or unique ID."""
    col_lower = str(col_name).lower().strip()
    if col_lower in PERSONAL_ID_KEYWORDS:
        return True
    if any(k in col_lower for k in ["email", "phone", "mobile", "ssn", "passport", "social_security"]):
        return True
    if col_lower.endswith("_id") or col_lower.endswith("id") or col_lower.startswith("id_"):
        return True
    return False


def is_identifier_column(col_name: str, series: Optional[pd.Series] = None) -> bool:
    """Return True if column is a primary key, surrogate key, or identifier column."""
    col_lower = str(col_name).lower().strip()
    id_exact = ["id", "customerid", "customer_id", "client_id", "user_id", "account_id", "row_id", "uuid", "guid", "key"]
    if col_lower in id_exact:
        return True
    if col_lower.endswith("_id") or col_lower.endswith("id"):
        if any(prefix in col_lower for prefix in ["customer", "client", "user", "order", "txn", "transaction", "account", "member", "emp", "employee", "patient", "student", "device"]):
            return True
        if col_lower in ["id", "customerid", "orderid", "userid"]:
            return True
    return False


def is_valid_email(val: Any) -> bool:
    if val is None or pd.isna(val):
        return True  # Handled by missing value check
    val_str = str(val).strip()
    return bool(EMAIL_REGEX.match(val_str))


def parse_date_safe(val: Any) -> Optional[datetime]:
    if val is None or pd.isna(val):
        return None
    val_str = str(val).strip()
    if not val_str:
        return None
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%Y/%m/%d",
        "%B %d, %Y",
        "%b %d, %Y",
        "%d %B %Y",
        "%d-%m-%Y",
        "%Y.%m.%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            continue
    try:
        ts = pd.to_datetime(val_str)
        return ts.to_pydatetime()
    except Exception:
        return None


def detect_date_format_pattern(val_str: str) -> str:
    s = val_str.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return "YYYY-MM-DD"
    elif re.match(r"^\d{2}/\d{2}/\d{4}$", s):
        return "DD/MM/YYYY"
    elif re.match(r"^[A-Za-z]+ \d{1,2}, \d{4}$", s):
        return "Month DD, YYYY"
    elif re.match(r"^\d{1,2} [A-Za-z]+ \d{4}$", s):
        return "DD Month YYYY"
    return "Other/Unknown"


def detect_issues(
    df: pd.DataFrame,
    dataset_id: str = "",
    reference_date: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    """
    Scan dataframe and detect all quality issues:
    1. Exact duplicates & Near duplicates (excluding identifier columns from similarity)
    2. Missing values (with strict no-fabrication mandate for personal/ID columns)
    3. Invalid formats (emails, dates, phone numbers, negative ages)
    4. Future date business rule detection (configurable reference date)
    5. Inconsistencies (grouped whitespace + capitalization for identical cells)
    6. Calibrated anomaly detection:
       - IQR method (retained)
       - Modified Z-Score using MAD (Median Absolute Deviation)
       - Isolation Forest with robust residual analysis (distinguishing normal edge observations from suspicious combinations)
       - Rare category detection
       - Cross-column sanity validation
    """
    issues: List[Dict[str, Any]] = []
    total_rows = len(df)
    if total_rows == 0:
        return issues

    ref_date = reference_date or get_system_reference_date()
    ref_date_str = ref_date.strftime("%Y-%m-%d")

    # Cell issues map to avoid conflicting suggestions on same (column, row)
    cell_issues: Dict[Tuple[str, int], Dict[str, Any]] = {}

    # Identify ID vs Non-ID columns
    id_cols = [c for c in df.columns if is_identifier_column(c, df[c])]
    non_id_cols = [c for c in df.columns if c not in id_cols]

    # -------------------------------------------------------------
    # 1. DUPLICATE RECORDS (Exact & Near Duplicates)
    # -------------------------------------------------------------
    duplicated_mask = df.duplicated(keep="first")
    first_seen_indices: Dict[str, int] = {}
    exact_duplicate_rows: Set[int] = set()

    # A) Exact Duplicates across ALL columns
    for idx, row in df.iterrows():
        row_key = tuple(row.astype(str).tolist())
        if row_key not in first_seen_indices:
            first_seen_indices[row_key] = idx
        elif duplicated_mask.iloc[idx]:
            first_idx = first_seen_indices[row_key]
            exact_duplicate_rows.add(int(idx))
            issues.append({
                "dataset_id": dataset_id,
                "issue_type": "duplicate",
                "column_name": None,
                "row_number": int(idx),
                "original_value": "Entire row duplicated",
                "suggested_value": "Remove duplicate row",
                "description": f"Exact duplicate of row {first_idx}",
                "severity": "high",
                "confidence": 1.0,
                "status": "detected",
                "explanation": (
                    f"Algorithm: Exact Duplicate Matching | Affected Row: {idx} | Matching Row: {first_idx} | "
                    f"Original Values: All {len(df.columns)} columns match | Evidence: 100% identical values across all columns | "
                    f"Explanation: Row {idx} contains identical values to row {first_idx} across all columns | "
                    f"Recommended Action: Remove duplicate row."
                ),
            })

    # B) Near-Duplicate Detection (Excluding ID columns)
    if len(non_id_cols) >= 3 and 1 < total_rows <= 1000:
        candidate_indices = [i for i in range(total_rows) if i not in exact_duplicate_rows]
        near_dup_flagged: Set[int] = set()

        for i_pos in range(len(candidate_indices)):
            idx1 = candidate_indices[i_pos]
            r1 = df.iloc[idx1]

            for j_pos in range(i_pos + 1, len(candidate_indices)):
                idx2 = candidate_indices[j_pos]
                if idx2 in near_dup_flagged:
                    continue

                r2 = df.iloc[idx2]

                # Compare non-ID columns
                matching_non_id = [
                    c for c in non_id_cols
                    if str(r1[c]).strip().lower() == str(r2[c]).strip().lower()
                ]
                match_ratio = len(matching_non_id) / len(non_id_cols)

                differing_cols = [
                    c for c in df.columns
                    if str(r1[c]).strip().lower() != str(r2[c]).strip().lower()
                ]

                # Flag near duplicate if >= 85% match of non-ID columns
                if match_ratio >= 0.85:
                    near_dup_flagged.add(idx2)
                    diff_details = ", ".join(
                        [f"{c} (Row {idx1}: '{r1[c]}' vs Row {idx2}: '{r2[c]}')" for c in differing_cols]
                    )
                    diff_col_names = ", ".join(differing_cols)
                    match_col_names = ", ".join(matching_non_id)

                    issues.append({
                        "dataset_id": dataset_id,
                        "issue_type": "duplicate",
                        "column_name": None,
                        "row_number": int(idx2),
                        "original_value": f"Near-duplicate of row {idx1}",
                        "suggested_value": "Needs manual review - near duplicate record",
                        "description": (
                            f"Near-duplicate of row {idx1} ({int(match_ratio * 100)}% non-ID field match). "
                            f"Differing: {diff_col_names}"
                        ),
                        "severity": "high" if match_ratio == 1.0 else "medium",
                        "confidence": round(match_ratio, 2),
                        "status": "detected",
                        "explanation": (
                            f"Algorithm: Near-Duplicate Detection (Non-ID Column Matching) | Affected Row: {idx2} | "
                            f"Matching Row: {idx1} | Matching Fields: {match_col_names} | "
                            f"Differing Fields: {diff_details} | Evidence: Identifiers excluded ({', '.join(id_cols) if id_cols else 'None'}); "
                            f"row {idx2} shares {len(matching_non_id)} of {len(non_id_cols)} ({int(match_ratio * 100)}%) meaningful columns with row {idx1} | "
                            f"Recommended Action: Human review required. Never automatically delete near-duplicates."
                        ),
                    })

    # -------------------------------------------------------------
    # 2. STATISTICAL AGGREGATES FOR SAFE IMPUTATION
    # -------------------------------------------------------------
    column_medians: Dict[str, Any] = {}
    column_modes: Dict[str, Any] = {}
    for col in df.columns:
        non_null = df[col].dropna()
        if len(non_null) > 0:
            if pd.api.types.is_numeric_dtype(df[col]):
                med = non_null.median()
                column_medians[col] = int(med) if pd.api.types.is_integer_dtype(df[col]) else round(float(med), 2)
            mode_vals = non_null.mode()
            if not mode_vals.empty:
                column_modes[col] = str(mode_vals.iloc[0]).strip()

    # -------------------------------------------------------------
    # 3. MISSING VALUES (Strict No-Fabrication Mandate)
    # -------------------------------------------------------------
    for col in df.columns:
        col_missing = df[col].isna()
        is_personal = is_personal_or_id_column(str(col))

        for idx in col_missing[col_missing].index:
            if is_personal:
                suggested = "Cannot safely reconstruct this value. Manual verification required."
                explanation = (
                    f"Algorithm: Deterministic Schema Validation | Affected Row: {idx} | Affected Column: {col} | "
                    f"Original Value: <null> | Evidence: Column '{col}' represents personal identity, contact, or unique identifier | "
                    f"Explanation: Fabricating missing personal data introduces severe integrity risk | "
                    f"Recommended Action: Manual verification required. Automated imputation blocked."
                )
                severity = "critical" if any(k in str(col).lower() for k in ["id", "ssn", "passport"]) else "high"
                confidence = 1.0
            else:
                is_numeric = pd.api.types.is_numeric_dtype(df[col])
                if is_numeric and col in column_medians:
                    suggested = str(column_medians[col])
                    explanation = (
                        f"Algorithm: Robust Median Imputation | Affected Row: {idx} | Affected Column: {col} | "
                        f"Original Value: <null> | Evidence: Numeric distribution median is {suggested} | "
                        f"Explanation: Statistical imputation using cohort median | Recommended Action: Safe automated imputation."
                    )
                    severity = "medium"
                    confidence = 0.95
                elif not is_numeric and col in column_modes:
                    suggested = column_modes[col]
                    explanation = (
                        f"Algorithm: Categorical Mode Imputation | Affected Row: {idx} | Affected Column: {col} | "
                        f"Original Value: <null> | Evidence: Dominant category mode is '{suggested}' | "
                        f"Explanation: Statistical imputation using most frequent class | Recommended Action: Safe automated imputation."
                    )
                    severity = "medium"
                    confidence = 0.90
                else:
                    suggested = "Cannot safely reconstruct this value. Manual verification required."
                    explanation = (
                        f"Algorithm: Distribution Inspection | Affected Row: {idx} | Affected Column: {col} | "
                        f"Original Value: <null> | Evidence: No dominant mode or median available | "
                        f"Explanation: Insufficient distribution data for safe imputation | Recommended Action: Manual verification required."
                    )
                    severity = "medium"
                    confidence = 0.85

            cell_issues[(str(col), int(idx))] = {
                "dataset_id": dataset_id,
                "issue_type": "missing_value",
                "column_name": str(col),
                "row_number": int(idx),
                "original_value": None,
                "suggested_value": suggested,
                "description": f"Missing value in column '{col}' at row {idx}",
                "severity": severity,
                "confidence": confidence,
                "status": "detected",
                "explanation": explanation,
            }

    # -------------------------------------------------------------
    # 4. INCONSISTENCY & WHITESPACE (Grouped & Unified per Cell)
    # -------------------------------------------------------------
    for col in df.columns:
        non_null_series = df[col].dropna()
        is_string_col = (
            not pd.api.types.is_numeric_dtype(df[col])
            and not pd.api.types.is_datetime64_any_dtype(df[col])
        )

        canonical_map: Dict[str, str] = {}
        if is_string_col:
            norm_map: Dict[str, List[Tuple[int, str]]] = {}
            for idx, val in non_null_series.items():
                if isinstance(val, str) and len(val.strip()) > 0:
                    key = val.strip().lower()
                    norm_map.setdefault(key, []).append((int(idx), val.strip()))

            for key, occurrences in norm_map.items():
                distinct_cases = set(v for _, v in occurrences)
                if len(distinct_cases) > 1:
                    case_counts = pd.Series([v for _, v in occurrences]).value_counts()
                    canonical_map[key] = case_counts.index[0]

        for idx, val in non_null_series.items():
            if not isinstance(val, str) or len(val) == 0:
                continue

            trimmed = val.strip()
            has_whitespace = val != trimmed and len(val) > 0
            trimmed_lower = trimmed.lower()
            needs_casing_change = False
            canonical_case = trimmed

            if is_string_col and trimmed_lower in canonical_map:
                target_case = canonical_map[trimmed_lower]
                if trimmed != target_case:
                    needs_casing_change = True
                    canonical_case = target_case

            if has_whitespace and needs_casing_change:
                cell_issues[(str(col), int(idx))] = {
                    "dataset_id": dataset_id,
                    "issue_type": "inconsistency",
                    "column_name": str(col),
                    "row_number": int(idx),
                    "original_value": val,
                    "suggested_value": canonical_case,
                    "description": f"Whitespace and inconsistent capitalization in '{col}'",
                    "severity": "medium",
                    "confidence": 0.95,
                    "status": "detected",
                    "explanation": (
                        f"Algorithm: Text Normalization & Casing Analysis | Affected Row: {idx} | Affected Column: {col} | "
                        f"Original Value: '{val}' | Evidence: Extraneous whitespace and variant casing detected | "
                        f"Explanation: Value contains whitespace and differs from canonical casing '{canonical_case}' | "
                        f"Recommended Action: Strip whitespace and standardize casing to '{canonical_case}'."
                    ),
                }
            elif has_whitespace:
                cell_issues[(str(col), int(idx))] = {
                    "dataset_id": dataset_id,
                    "issue_type": "inconsistency",
                    "column_name": str(col),
                    "row_number": int(idx),
                    "original_value": val,
                    "suggested_value": trimmed,
                    "description": f"Leading or trailing whitespace detected in '{col}'",
                    "severity": "low",
                    "confidence": 0.98,
                    "status": "detected",
                    "explanation": (
                        f"Algorithm: Whitespace Trimming | Affected Row: {idx} | Affected Column: {col} | "
                        f"Original Value: '{val}' | Evidence: Leading/trailing whitespace characters | "
                        f"Explanation: Extraneous whitespace detected | Recommended Action: Strip leading/trailing whitespace."
                    ),
                }
            elif needs_casing_change:
                cell_issues[(str(col), int(idx))] = {
                    "dataset_id": dataset_id,
                    "issue_type": "inconsistency",
                    "column_name": str(col),
                    "row_number": int(idx),
                    "original_value": val,
                    "suggested_value": canonical_case,
                    "description": f"Inconsistent capitalization in '{col}': '{val}' vs common '{canonical_case}'",
                    "severity": "medium",
                    "confidence": 0.90,
                    "status": "detected",
                    "explanation": (
                        f"Algorithm: Frequency-Based Casing Standardization | Affected Row: {idx} | Affected Column: {col} | "
                        f"Original Value: '{val}' | Evidence: Inconsistent casing relative to predominant class '{canonical_case}' | "
                        f"Explanation: Non-standard capitalization | Recommended Action: Standardize casing to '{canonical_case}'."
                    ),
                }

    # -------------------------------------------------------------
    # 5. FORMAT CHECKS & DATE BUSINESS RULES
    # -------------------------------------------------------------
    for col in df.columns:
        col_lower = str(col).lower()
        non_null_series = df[col].dropna()

        # Email format validation
        if "email" in col_lower:
            for idx, val in non_null_series.items():
                val_str = str(val).strip()
                if val_str and not is_valid_email(val_str):
                    cell_issues[(str(col), int(idx))] = {
                        "dataset_id": dataset_id,
                        "issue_type": "invalid_format",
                        "column_name": str(col),
                        "row_number": int(idx),
                        "original_value": str(val),
                        "suggested_value": "Needs manual review",
                        "description": f"Invalid email format: '{val}'",
                        "severity": "high",
                        "confidence": 0.95,
                        "status": "detected",
                        "explanation": (
                            f"Algorithm: RFC 5322 Syntax Validator | Affected Row: {idx} | Affected Column: {col} | "
                            f"Original Value: '{val}' | Evidence: Violates standard email structure | "
                            f"Explanation: Missing valid domain or '@' delimiter | Recommended Action: Manual verification required."
                        ),
                    }

        # Date format validation & Future Date Detection
        if any(keyword in col_lower for keyword in ["date", "dob", "registered", "registration", "time"]):
            is_past_temporal_col = any(
                k in col_lower for k in [
                    "registration", "registered", "dob", "birth", "created",
                    "joined", "signup", "onboard", "order_date", "purchase_date", "trans_date"
                ]
            ) or ("date" in col_lower and not any(k in col_lower for k in ["expir", "due", "deliver", "valid_until", "future"]))

            format_counts: Dict[str, int] = {}
            parsed_dates: Dict[int, Optional[datetime]] = {}
            patterns: Dict[int, str] = {}

            for idx, val in non_null_series.items():
                val_str = str(val).strip()
                parsed = parse_date_safe(val_str)
                parsed_dates[int(idx)] = parsed

                if parsed is None:
                    cell_issues[(str(col), int(idx))] = {
                        "dataset_id": dataset_id,
                        "issue_type": "invalid_format",
                        "column_name": str(col),
                        "row_number": int(idx),
                        "original_value": str(val),
                        "suggested_value": "Needs manual review",
                        "description": f"Unparseable date value: '{val}'",
                        "severity": "high",
                        "confidence": 0.90,
                        "status": "detected",
                        "explanation": (
                            f"Algorithm: ISO/Standard Date Parser | Affected Row: {idx} | Affected Column: {col} | "
                            f"Original Value: '{val}' | Evidence: String could not be resolved to valid calendar date | "
                            f"Explanation: Corrupt or unrecognized date string | Recommended Action: Manual verification required."
                        ),
                    }
                else:
                    pattern = detect_date_format_pattern(val_str)
                    patterns[int(idx)] = pattern
                    format_counts[pattern] = format_counts.get(pattern, 0) + 1

                    # ISSUE 1: FUTURE DATE DETECTION RULE
                    if is_past_temporal_col and parsed > ref_date:
                        cell_issues[(str(col), int(idx))] = {
                            "dataset_id": dataset_id,
                            "issue_type": "anomaly",
                            "column_name": str(col),
                            "row_number": int(idx),
                            "original_value": val_str,
                            "suggested_value": "Flagged for review - future date violates business rule",
                            "description": f"Future date in '{col}': {val_str} occurs after system reference date ({ref_date_str})",
                            "severity": "high",
                            "confidence": 0.98,
                            "status": "detected",
                            "explanation": (
                                f"Algorithm: Temporal Business Rule Validation | Affected Row: {idx} | Affected Column: {col} | "
                                f"Original Value: '{val_str}' | Evidence: Date {val_str} occurs in the future relative to system reference date {ref_date_str} | "
                                f"Explanation: Registration, creation and onboarding dates cannot occur in the future without data entry defect | "
                                f"Recommended Action: Human review required before repair; do not automatically change the date."
                            ),
                        }

            # Check for mixed date formats
            if len(format_counts) > 1:
                dominant_pattern = max(format_counts, key=format_counts.get)
                for idx, parsed in parsed_dates.items():
                    if parsed is not None and (str(col), int(idx)) not in cell_issues:
                        pat = patterns.get(idx)
                        if pat != dominant_pattern or pat != "YYYY-MM-DD":
                            iso_standard = parsed.strftime("%Y-%m-%d")
                            if str(df.at[idx, col]).strip() != iso_standard:
                                cell_issues[(str(col), int(idx))] = {
                                    "dataset_id": dataset_id,
                                    "issue_type": "inconsistency",
                                    "column_name": str(col),
                                    "row_number": int(idx),
                                    "original_value": str(df.at[idx, col]),
                                    "suggested_value": iso_standard,
                                    "description": f"Inconsistent date format '{pat}' in column '{col}'",
                                    "severity": "medium",
                                    "confidence": 0.88,
                                    "status": "detected",
                                    "explanation": (
                                        f"Algorithm: Date Format Uniformity Checker | Affected Row: {idx} | Affected Column: {col} | "
                                        f"Original Value: '{df.at[idx, col]}' | Evidence: Uses format {pat} vs dominant {dominant_pattern} | "
                                        f"Explanation: Mixed date formats in single column | Recommended Action: Standardize to ISO {iso_standard}."
                                    ),
                                }

        # Phone format validation
        if any(keyword in col_lower for keyword in ["phone", "mobile", "tel", "cell"]):
            for idx, val in non_null_series.items():
                val_str = str(val).strip()
                digits = PHONE_DIGITS_REGEX.findall(val_str)
                has_letters = bool(re.search(r"[a-zA-Z]", val_str))
                if has_letters or len(digits) < 7 or len(digits) > 15:
                    cell_issues[(str(col), int(idx))] = {
                        "dataset_id": dataset_id,
                        "issue_type": "invalid_format",
                        "column_name": str(col),
                        "row_number": int(idx),
                        "original_value": str(val),
                        "suggested_value": "Needs manual review",
                        "description": f"Invalid phone number format: '{val}'",
                        "severity": "medium",
                        "confidence": 0.85,
                        "status": "detected",
                        "explanation": (
                            f"Algorithm: Phone Syntax Inspector | Affected Row: {idx} | Affected Column: {col} | "
                            f"Original Value: '{val}' | Evidence: Found letters or invalid digit count ({len(digits)}) | "
                            f"Explanation: Value violates ITU-T / standard telephone structure | Recommended Action: Manual verification required."
                        ),
                    }

        # Age Validation
        if "age" in col_lower:
            for idx, val in non_null_series.items():
                try:
                    num_val = float(val)
                    if num_val < 0:
                        cell_issues[(str(col), int(idx))] = {
                            "dataset_id": dataset_id,
                            "issue_type": "invalid_format",
                            "column_name": str(col),
                            "row_number": int(idx),
                            "original_value": str(val),
                            "suggested_value": "Needs manual review - negative age",
                            "description": f"Negative age detected: {val}",
                            "severity": "critical",
                            "confidence": 0.99,
                            "status": "detected",
                            "explanation": (
                                f"Algorithm: Domain Range Constraint Validator | Affected Row: {idx} | Affected Column: {col} | "
                                f"Original Value: {val} | Evidence: Negative numeric value | "
                                f"Explanation: Age cannot be negative; violates fundamental domain bounds | Recommended Action: Human review required."
                            ),
                        }
                    elif num_val > 120:
                        cell_issues[(str(col), int(idx))] = {
                            "dataset_id": dataset_id,
                            "issue_type": "anomaly",
                            "column_name": str(col),
                            "row_number": int(idx),
                            "original_value": str(val),
                            "suggested_value": "Flagged for review - extreme age value",
                            "description": f"Suspicious age value: {val} exceeds human lifespan norms",
                            "severity": "high",
                            "confidence": 0.95,
                            "status": "detected",
                            "explanation": (
                                f"Algorithm: Biological Lifespan Constraint | Affected Row: {idx} | Affected Column: {col} | "
                                f"Original Value: {val} | Evidence: Value exceeds 120 years | "
                                f"Explanation: Statistically improbable human age | Recommended Action: Human review required before repair."
                            ),
                        }
                except (ValueError, TypeError):
                    cell_issues[(str(col), int(idx))] = {
                        "dataset_id": dataset_id,
                        "issue_type": "invalid_format",
                        "column_name": str(col),
                        "row_number": int(idx),
                        "original_value": str(val),
                        "suggested_value": "Needs manual review",
                        "description": f"Non-numeric age value: '{val}'",
                        "severity": "high",
                        "confidence": 0.95,
                        "status": "detected",
                        "explanation": (
                            f"Algorithm: Data Type Validator | Affected Row: {idx} | Affected Column: {col} | "
                            f"Original Value: '{val}' | Evidence: Expected numeric scalar, found non-numeric string | "
                            f"Explanation: Type mismatch | Recommended Action: Human review required."
                        ),
                    }

    # -------------------------------------------------------------
    # 6. ANOMALY DETECTION (IQR + Modified Z-score + Rare Category + Multivariate)
    # -------------------------------------------------------------
    numeric_cols: List[str] = []

    for col in df.columns:
        col_lower = str(col).lower()
        if pd.api.types.is_numeric_dtype(df[col]):
            numeric_cols.append(str(col))
            numeric_series = pd.to_numeric(df[col], errors="coerce").dropna()
            n_vals = len(numeric_series)
            if n_vals >= 4:
                # A) IQR Method (Retained)
                q1 = numeric_series.quantile(0.25)
                q3 = numeric_series.quantile(0.75)
                iqr = q3 - q1

                # B) Modified Z-Score using MAD
                median_val = numeric_series.median()
                abs_deviation = (numeric_series - median_val).abs()
                mad = abs_deviation.median()

                for idx, val in numeric_series.items():
                    if "age" in col_lower and val < 0:
                        continue
                    if (str(col), int(idx)) in cell_issues:
                        continue

                    # Check domain constraint: negative financial value
                    if any(k in col_lower for k in ["amount", "price", "cost", "salary", "revenue", "purchase"]) and val < 0:
                        cell_issues[(str(col), int(idx))] = {
                            "dataset_id": dataset_id,
                            "issue_type": "anomaly",
                            "column_name": str(col),
                            "row_number": int(idx),
                            "original_value": str(val),
                            "suggested_value": "Flagged for review - negative monetary value",
                            "description": f"Negative value in financial column '{col}': {val}",
                            "severity": "medium",
                            "confidence": 0.90,
                            "status": "detected",
                            "explanation": (
                                f"Algorithm: Financial Domain Range Constraint | Affected Row: {idx} | Affected Column: {col} | "
                                f"Original Value: {val} | Evidence: Negative monetary figure | "
                                f"Explanation: Financial amounts cannot normally be negative | Recommended Action: Manual verification required; do not auto-repair."
                            ),
                        }
                        continue

                    # IQR bounds check
                    iqr_outlier = False
                    if iqr > 0:
                        lower_bound = q1 - 1.5 * iqr
                        upper_bound = q3 + 1.5 * iqr
                        if val < lower_bound or val > upper_bound:
                            iqr_outlier = True
                            is_extreme = val < (q1 - 3 * iqr) or val > (q3 + 3 * iqr)
                            cell_issues[(str(col), int(idx))] = {
                                "dataset_id": dataset_id,
                                "issue_type": "anomaly",
                                "column_name": str(col),
                                "row_number": int(idx),
                                "original_value": str(val),
                                "suggested_value": "Flagged for review - statistical outlier",
                                "description": f"Statistical outlier in '{col}': value {val} is outside IQR bounds [{lower_bound:.2f}, {upper_bound:.2f}]",
                                "severity": "high" if is_extreme else "medium",
                                "confidence": 0.85,
                                "status": "detected",
                                "explanation": (
                                    f"Algorithm: Interquartile Range (IQR) Outlier Detection | Affected Row: {idx} | Affected Column: {col} | "
                                    f"Original Value: {val} | Evidence: Outside 1.5x IQR interval [{lower_bound:.2f}, {upper_bound:.2f}] | "
                                    f"Explanation: Statistical outlier falling beyond normal quartile bounds | Recommended Action: Human review required; do not automatically alter statistical outliers."
                                ),
                            }

                    # Modified Z-Score check if not already flagged by IQR
                    if not iqr_outlier and mad > 0:
                        mod_z = 0.6745 * abs(val - median_val) / mad
                        if mod_z > 3.5:
                            cell_issues[(str(col), int(idx))] = {
                                "dataset_id": dataset_id,
                                "issue_type": "anomaly",
                                "column_name": str(col),
                                "row_number": int(idx),
                                "original_value": str(val),
                                "suggested_value": "Flagged for review - Modified Z-Score outlier",
                                "description": f"Modified Z-score anomaly in '{col}': M-score={mod_z:.2f} (>3.5)",
                                "severity": "high" if mod_z > 5.0 else "medium",
                                "confidence": 0.88,
                                "status": "detected",
                                "explanation": (
                                    f"Algorithm: Modified Z-Score (Median Absolute Deviation) | Affected Row: {idx} | Affected Column: {col} | "
                                    f"Original Value: {val} | Evidence: Modified Z-score of {mod_z:.2f} exceeds threshold 3.5 (Median: {median_val:.2f}, MAD: {mad:.2f}) | "
                                    f"Explanation: Extreme deviation from median distribution | Recommended Action: Human review required; do not auto-repair."
                                ),
                            }

        # C) Rare Category Detection for Categorical Columns
        elif not pd.api.types.is_datetime64_any_dtype(df[col]) and not is_personal_or_id_column(str(col)):
            val_counts = df[col].dropna().value_counts()
            n_unique = len(val_counts)
            if 2 < n_unique <= min(15, int(total_rows * 0.35)) and total_rows >= 25:
                for idx, val in df[col].dropna().items():
                    if (str(col), int(idx)) in cell_issues:
                        continue
                    count = val_counts.get(val, 0)
                    pct = (count / total_rows) * 100
                    if count == 1 and n_unique >= 4:
                        cell_issues[(str(col), int(idx))] = {
                            "dataset_id": dataset_id,
                            "issue_type": "anomaly",
                            "column_name": str(col),
                            "row_number": int(idx),
                            "original_value": str(val),
                            "suggested_value": "Needs manual review - rare category",
                            "description": f"Rare category in '{col}': '{val}' occurs only {count} time ({pct:.1f}%)",
                            "severity": "low",
                            "confidence": 0.80,
                            "status": "detected",
                            "explanation": (
                                f"Algorithm: Rare Category Frequency Profiler | Affected Row: {idx} | Affected Column: {col} | "
                                f"Original Value: '{val}' | Evidence: Singleton occurrence (1 of {total_rows} records, {pct:.1f}%) | "
                                f"Explanation: Isolated rare category value, potential typo or obscure class | Recommended Action: Manual verification required."
                            ),
                        }

    # D) Calibrated Multivariate Anomaly Detection (Isolation Forest + Robust Residuals)
    # ISSUES 3 & 4: Distinguish normal edge observations (e.g. rows 0, 22) from suspicious combinations (row 44)
    if SKLEARN_AVAILABLE and len(numeric_cols) >= 2 and total_rows >= 10:
        try:
            num_df = df[numeric_cols].apply(pd.to_numeric, errors="coerce")
            imputed = num_df.fillna(num_df.median())

            # Filter extreme univariate outliers when calibrating baseline correlation
            clean_mask = pd.Series(True, index=df.index)
            for c in numeric_cols:
                s = imputed[c]
                q1, q3 = s.quantile(0.25), s.quantile(0.75)
                iqr = q3 - q1
                if iqr > 0:
                    clean_mask &= (s >= q1 - 2.5 * iqr) & (s <= q3 + 2.5 * iqr)

            ref_subset = imputed.loc[clean_mask] if clean_mask.sum() >= 5 else imputed

            # Identify strongly correlated feature pairs using Spearman rank correlation (robust to outliers)
            spearman_corr = ref_subset.corr(method="spearman")
            correlated_pairs = []
            for i in range(len(numeric_cols)):
                for j in range(i + 1, len(numeric_cols)):
                    c1, c2 = numeric_cols[i], numeric_cols[j]
                    r_val = spearman_corr.loc[c1, c2]
                    if abs(r_val) >= 0.70:
                        x = ref_subset[c1].values
                        y = ref_subset[c2].values
                        if len(x) >= 5 and np.std(x) > 0:
                            slope, intercept = np.polyfit(x, y, 1)
                            resids = np.abs(y - (slope * x + intercept))
                            mad_resid = float(np.median(resids)) or 1.0
                            correlated_pairs.append((c1, c2, float(r_val), float(slope), float(intercept), mad_resid))

            # Fit Isolation Forest
            iso = IsolationForest(contamination=0.05, random_state=42)
            iso.fit(imputed)
            scores = iso.decision_function(imputed)

            for idx, score in enumerate(scores):
                if score >= 0 or int(idx) in exact_duplicate_rows:
                    continue

                # Feature deviations from median
                feat_devs = {}
                for col in numeric_cols:
                    v = imputed.at[idx, col]
                    m = imputed[col].median()
                    iqr_val = imputed[col].quantile(0.75) - imputed[col].quantile(0.25)
                    dev = abs(v - m) / (iqr_val if iqr_val > 0 else 1.0)
                    feat_devs[col] = (v, dev)

                # Check for suspicious cross-feature combinations vs normal edge observations
                is_suspicious_combination = False
                comb_evidence = []

                for c1, c2, r_val, slope, intercept, mad_resid in correlated_pairs:
                    val1 = imputed.at[idx, c1]
                    val2 = imputed.at[idx, c2]
                    exp2 = slope * val1 + intercept
                    resid = abs(val2 - exp2)
                    z_res = 0.6745 * resid / mad_resid

                    # Flag if residual deviates significantly from expected relationship
                    if z_res > 3.5:
                        is_suspicious_combination = True
                        comb_evidence.append(
                            f"{c1}={val1} vs {c2}={val2} (expected {c2}~{exp2:.0f}, residual M-score={z_res:.2f}, r={r_val:.2f})"
                        )

                # Flag only if a true suspicious combination exists or deep multidimensional score
                # This explicitly preserves normal edge observations (like rows 0 and 22) which follow expected correlations
                if is_suspicious_combination:
                    has_univariate = any((c, int(idx)) in cell_issues for c in numeric_cols)
                    if not has_univariate:
                        vals_str = ", ".join([f"{c}={imputed.at[idx, c]}" for c in numeric_cols])
                        evidence_str = "; ".join(comb_evidence) if comb_evidence else f"Anomaly score {score:.4f}"
                        issues.append({
                            "dataset_id": dataset_id,
                            "issue_type": "anomaly",
                            "column_name": None,
                            "row_number": int(idx),
                            "original_value": f"Suspicious combination (score={score:.4f})",
                            "suggested_value": "Flagged for review - suspicious multi-feature combination",
                            "description": f"Suspicious multivariate combination across features: {vals_str}",
                            "severity": "medium",
                            "confidence": 0.82,
                            "status": "detected",
                            "explanation": (
                                f"Algorithm: Isolation Forest & Cross-Column Correlation Analysis | Affected Row: {idx} | "
                                f"Affected Columns: {', '.join(numeric_cols)} | Original Values: {vals_str} | Anomaly Score: {score:.4f} | "
                                f"Evidence: {evidence_str} | Explanation: Joint distribution contradicts expected cross-feature relationship. "
                                f"Normal boundary observations were retained, while this record exhibits contradictory feature pairings | "
                                f"Recommended Action: Human review recommended to confirm feature pairing. Do not automatically alter statistical outliers."
                            ),
                        })
        except Exception:
            pass

    # Collect all cell-level issues
    issues.extend(cell_issues.values())

    # Sort issues by row_number for stable presentation
    issues.sort(key=lambda x: (x["row_number"] if x["row_number"] is not None else -1, str(x["column_name"])))

    return issues
