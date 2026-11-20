from typing import Dict, Any, List
import pandas as pd
import numpy as np


def profile_dataset(df: pd.DataFrame, dataset_id: str = "") -> Dict[str, Any]:
    """
    Generate comprehensive profiling metadata for a pandas DataFrame.
    Includes data types, null counts, unique counts, sample values, and statistics.
    """
    total_rows = len(df)
    total_columns = len(df.columns)

    columns_profile: List[Dict[str, Any]] = []

    for col in df.columns:
        col_series = df[col]
        missing_count = int(col_series.isna().sum())
        missing_pct = round((missing_count / total_rows * 100), 2) if total_rows > 0 else 0.0

        non_null_series = col_series.dropna()
        unique_count = int(non_null_series.nunique())
        unique_pct = round((unique_count / total_rows * 100), 2) if total_rows > 0 else 0.0

        # Sample values
        sample_vals = []
        for val in non_null_series.head(5).tolist():
            if isinstance(val, (np.integer, int)):
                sample_vals.append(int(val))
            elif isinstance(val, (np.floating, float)):
                sample_vals.append(round(float(val), 4) if not np.isnan(val) else None)
            else:
                sample_vals.append(str(val))

        # Determine semantic/pandas data type
        is_numeric = pd.api.types.is_numeric_dtype(col_series)
        is_datetime = pd.api.types.is_datetime64_any_dtype(col_series)
        is_bool = pd.api.types.is_bool_dtype(col_series)

        if is_bool:
            dtype_label = "boolean"
        elif pd.api.types.is_integer_dtype(col_series):
            dtype_label = "integer"
        elif is_numeric:
            dtype_label = "float"
        elif is_datetime:
            dtype_label = "datetime"
        else:
            dtype_label = "string"

        # Compute column statistics
        stats: Dict[str, Any] = {}
        if is_numeric and len(non_null_series) > 0:
            numeric_vals = pd.to_numeric(non_null_series, errors="coerce").dropna()
            if len(numeric_vals) > 0:
                q1 = float(numeric_vals.quantile(0.25))
                q3 = float(numeric_vals.quantile(0.75))
                iqr = q3 - q1
                stats = {
                    "min": float(numeric_vals.min()),
                    "max": float(numeric_vals.max()),
                    "mean": round(float(numeric_vals.mean()), 2),
                    "median": round(float(numeric_vals.median()), 2),
                    "std": round(float(numeric_vals.std()), 2) if len(numeric_vals) > 1 else 0.0,
                    "q1": round(q1, 2),
                    "q3": round(q3, 2),
                    "iqr": round(iqr, 2),
                }
        else:
            # Categorical frequency stats
            val_counts = non_null_series.astype(str).value_counts().head(5).to_dict()
            stats = {
                "top_values": {str(k): int(v) for k, v in val_counts.items()}
            }

        columns_profile.append({
            "name": str(col),
            "data_type": dtype_label,
            "missing_count": missing_count,
            "missing_percentage": missing_pct,
            "unique_count": unique_count,
            "unique_percentage": unique_pct,
            "sample_values": sample_vals,
            "stats": stats,
        })

    return {
        "dataset_id": dataset_id,
        "total_rows": total_rows,
        "total_columns": total_columns,
        "columns": columns_profile,
    }
