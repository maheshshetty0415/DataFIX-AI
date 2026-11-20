from typing import List, Dict, Any, Union, Optional
from backend.database import Issue

# Transparent severity weights used for quality score calculation:
# - Critical (3.0): Corrupts data validity or breaks domain bounds (negative age, bad identifiers)
# - High (2.0): Significant data loss or format failure (unparseable dates, bad email, exact duplicates)
# - Medium (1.0): Inconsistent casing, non-critical missing values, near-duplicates
# - Low (0.5): Minor cosmetic inconsistencies (leading/trailing whitespace)
SEVERITY_WEIGHTS = {
    "critical": 3.0,
    "high": 2.0,
    "medium": 1.0,
    "low": 0.5,
}


def calculate_quality_score(
    issues: List[Union[Issue, Dict[str, Any]]],
    total_rows: int,
    total_columns: int,
) -> float:
    """
    Calculate data quality score (0-100) using the documented formula:
    score = max(0, 100 * (1 - (weighted_issues / total_cells)))
    
    Weights:
    - Critical: 3.0 points
    - High: 2.0 points
    - Medium: 1.0 points
    - Low: 0.5 points
    """
    total_cells = max(1, total_rows * total_columns)
    
    weighted_issues = 0.0
    for issue in issues:
        severity = issue.severity if isinstance(issue, Issue) else issue.get("severity", "medium")
        severity_clean = str(severity).lower()
        weight = SEVERITY_WEIGHTS.get(severity_clean, 1.0)
        weighted_issues += weight

    penalty_ratio = weighted_issues / total_cells
    raw_score = 100.0 * (1.0 - penalty_ratio)
    final_score = max(0.0, min(100.0, raw_score))
    return round(final_score, 2)


def get_score_breakdown(
    issues: List[Union[Issue, Dict[str, Any]]],
    total_rows: int,
    total_columns: int,
    initial_score: Optional[float] = None,
    current_score: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Get detailed breakdown of issues count, weights, score calculation,
    and a clear natural-language explanation.
    """
    total_cells = max(1, total_rows * total_columns)
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    weighted_sum = 0.0

    for issue in issues:
        severity = issue.severity if isinstance(issue, Issue) else issue.get("severity", "medium")
        severity_clean = str(severity).lower()
        if severity_clean in counts:
            counts[severity_clean] += 1
            weighted_sum += SEVERITY_WEIGHTS[severity_clean]
        else:
            counts["medium"] += 1
            weighted_sum += SEVERITY_WEIGHTS["medium"]

    score = calculate_quality_score(issues, total_rows, total_columns)
    curr = current_score if current_score is not None else score
    init = initial_score if initial_score is not None else score
    improvement = round(max(0.0, curr - init), 2)

    explanation = (
        f"Score = max(0, 100 * (1 - {weighted_sum:.1f} / {total_cells})). "
        f"{len(issues)} active issue(s) deducted {weighted_sum:.1f} penalty points across {total_cells} data cells "
        f"[Critical: {counts['critical']}×3.0, High: {counts['high']}×2.0, Medium: {counts['medium']}×1.0, Low: {counts['low']}×0.5]."
    )

    return {
        "score": score,
        "initial_quality_score": init,
        "current_quality_score": curr,
        "score_improvement": improvement,
        "remaining_issues": len(issues),
        "total_cells": total_cells,
        "total_issues": len(issues),
        "weighted_deductions": weighted_sum,
        "severity_breakdown": counts,
        "calculation_explanation": explanation,
    }
