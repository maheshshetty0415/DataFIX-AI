import os
import io
import csv
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from backend.database import get_db, Dataset, Issue, AuditLog
from backend.models import AuditSummaryResponse, AuditLogResponse, StatsResponse
from backend.services.audit import get_audit_summary, get_audit_log
from backend.services.data_loader import (
    load_dataset_df,
    get_dataset_file_path,
)

router = APIRouter(prefix="/api", tags=["Reports & Export"])


@router.get("/audit/{dataset_id}", response_model=AuditSummaryResponse)
def get_dataset_audit(dataset_id: str, db: Session = Depends(get_db)):
    """Get complete audit logs and summary statistics for a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    summary = get_audit_summary(db, dataset_id)
    return AuditSummaryResponse(
        dataset_id=dataset_id,
        total_actions=summary["total_actions"],
        by_decision=summary["by_decision"],
        by_issue_type=summary["by_issue_type"],
        logs=[AuditLogResponse.model_validate(log) for log in summary["logs"]],
    )


@router.get("/export/{dataset_id}/csv")
def export_cleaned_csv(dataset_id: str, db: Session = Depends(get_db)):
    """Download cleaned dataset as CSV (or original if not yet repaired)."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = get_dataset_file_path(dataset_id, is_cleaned=True)
    if not file_path or not os.path.exists(file_path):
        file_path = get_dataset_file_path(dataset_id, is_cleaned=False)

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Export file not found.")

    base_name = os.path.splitext(dataset.original_filename)[0]
    export_name = f"{base_name}_cleaned.csv"

    return FileResponse(
        path=file_path,
        media_type="text/csv",
        filename=export_name,
    )


@router.get("/export/{dataset_id}/excel")
def export_cleaned_excel(dataset_id: str, db: Session = Depends(get_db)):
    """Download cleaned dataset as an Excel spreadsheet (.xlsx)."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    is_cleaned = dataset.status in ["repaired", "validated"]
    try:
        df = load_dataset_df(dataset_id, is_cleaned=is_cleaned)
    except Exception:
        df = load_dataset_df(dataset_id, is_cleaned=False)

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Cleaned Data")
    buffer.seek(0)

    base_name = os.path.splitext(dataset.original_filename)[0]
    export_name = f"{base_name}_cleaned.xlsx"

    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{export_name}"'},
    )


@router.get("/export/{dataset_id}/audit-csv")
def export_audit_log_csv(dataset_id: str, db: Session = Depends(get_db)):
    """Export dataset audit history as a downloadable CSV."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    logs = get_audit_log(db, dataset_id)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Audit_ID",
        "Timestamp_UTC",
        "Decision",
        "Issue_Type",
        "Column",
        "Row",
        "Original_Value",
        "New_Value",
        "Confidence",
        "Reason",
    ])

    for log in logs:
        writer.writerow([
            log.id,
            log.timestamp.isoformat() if log.timestamp else "",
            log.user_decision,
            log.issue_type,
            log.column_name or "",
            log.row_number if log.row_number is not None else "",
            log.original_value or "",
            log.new_value or "",
            log.confidence,
            log.reason,
        ])

    csv_data = output.getvalue()
    export_name = f"audit_trail_{dataset_id}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{export_name}"'},
    )


@router.get("/export/{dataset_id}/pdf")
def export_pdf_report(dataset_id: str, db: Session = Depends(get_db)):
    """Generate and download a comprehensive Data Quality & Repair PDF report using ReportLab."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    issues = db.query(Issue).filter(Issue.dataset_id == dataset_id).all()
    audit_logs = db.query(AuditLog).filter(AuditLog.dataset_id == dataset_id).all()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1e293b"),
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b"),
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155"),
    )
    bold_body_style = ParagraphStyle(
        "BoldBodyDark",
        parent=body_style,
        fontName="Helvetica-Bold",
    )

    elements = []

    # Title & Header
    elements.append(Paragraph("DataFix AI — Quality & Repair Report", title_style))
    elements.append(Paragraph(f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC", subtitle_style))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=14))

    # Dataset Summary Table
    elements.append(Paragraph("Dataset Overview", section_heading))
    q_before = f"{dataset.quality_score_before:.1f}%" if dataset.quality_score_before is not None else "N/A"
    q_after = f"{dataset.quality_score_after:.1f}%" if dataset.quality_score_after is not None else "N/A"
    improvement = (
        f"+{dataset.quality_score_after - dataset.quality_score_before:.1f}%"
        if dataset.quality_score_before is not None and dataset.quality_score_after is not None
        else "N/A"
    )

    overview_data = [
        [Paragraph("Original Filename:", bold_body_style), Paragraph(dataset.original_filename, body_style),
         Paragraph("Total Rows:", bold_body_style), Paragraph(str(dataset.total_rows), body_style)],
        [Paragraph("Upload Date:", bold_body_style), Paragraph(dataset.upload_date.strftime("%Y-%m-%d %H:%M"), body_style),
         Paragraph("Total Columns:", bold_body_style), Paragraph(str(dataset.total_columns), body_style)],
        [Paragraph("Status:", bold_body_style), Paragraph(dataset.status.upper(), body_style),
         Paragraph("Quality Before:", bold_body_style), Paragraph(q_before, body_style)],
        [Paragraph("Issues Detected:", bold_body_style), Paragraph(str(len(issues)), body_style),
         Paragraph("Quality After:", bold_body_style), Paragraph(f"{q_after} ({improvement})", body_style)],
    ]
    t_overview = Table(overview_data, colWidths=[110, 160, 100, 170])
    t_overview.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_overview)
    elements.append(Spacer(1, 14))

    # Issues Breakdown
    elements.append(Paragraph("Issues Detected by Type & Severity", section_heading))
    by_type: Dict[str, int] = {}
    by_sev: Dict[str, int] = {}
    for iss in issues:
        by_type[iss.issue_type] = by_type.get(iss.issue_type, 0) + 1
        by_sev[iss.severity] = by_sev.get(iss.severity, 0) + 1

    issue_table_data = [
        [Paragraph("Category / Dimension", bold_body_style), Paragraph("Detected Count", bold_body_style),
         Paragraph("Severity Level", bold_body_style), Paragraph("Count", bold_body_style)],
    ]

    types_list = list(by_type.items())
    sevs_list = list(by_sev.items())
    max_len = max(len(types_list), len(sevs_list), 1)

    for i in range(max_len):
        t_label = types_list[i][0].replace("_", " ").title() if i < len(types_list) else ""
        t_val = str(types_list[i][1]) if i < len(types_list) else ""
        s_label = sevs_list[i][0].title() if i < len(sevs_list) else ""
        s_val = str(sevs_list[i][1]) if i < len(sevs_list) else ""

        issue_table_data.append([
            Paragraph(t_label, body_style),
            Paragraph(t_val, body_style),
            Paragraph(s_label, body_style),
            Paragraph(s_val, body_style),
        ])

    t_issues = Table(issue_table_data, colWidths=[160, 110, 150, 120])
    t_issues.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_issues)
    elements.append(Spacer(1, 14))

    # Audit Trail Summary
    elements.append(Paragraph(f"Recent Audit Trail (Repairs & Modifications: {len(audit_logs)} Total)", section_heading))
    audit_table_data = [
        [
            Paragraph("Decision", bold_body_style),
            Paragraph("Type", bold_body_style),
            Paragraph("Column", bold_body_style),
            Paragraph("Row", bold_body_style),
            Paragraph("New Value", bold_body_style),
            Paragraph("Reason", bold_body_style),
        ]
    ]

    # Show up to 15 recent actions
    for entry in audit_logs[:15]:
        audit_table_data.append([
            Paragraph(entry.user_decision.upper(), body_style),
            Paragraph(entry.issue_type.replace("_", " "), body_style),
            Paragraph(entry.column_name or "Row", body_style),
            Paragraph(str(entry.row_number) if entry.row_number is not None else "-", body_style),
            Paragraph(str(entry.new_value)[:20] if entry.new_value else "-", body_style),
            Paragraph(entry.reason[:35] + ("..." if len(entry.reason) > 35 else ""), body_style),
        ])

    if len(audit_logs) == 0:
        audit_table_data.append([
            Paragraph("No repairs logged yet.", body_style),
            Paragraph("", body_style),
            Paragraph("", body_style),
            Paragraph("", body_style),
            Paragraph("", body_style),
            Paragraph("", body_style),
        ])

    t_audit = Table(audit_table_data, colWidths=[65, 85, 75, 45, 100, 170])
    t_audit.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(t_audit)

    doc.build(elements)
    buffer.seek(0)

    pdf_filename = f"DataFix_Report_{dataset_id}.pdf"
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{pdf_filename}"'},
    )


@router.get("/stats", response_model=StatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Get aggregate dashboard metrics directly from SQLite database:
    - Total datasets
    - Total issues detected
    - Open issues, accepted repairs, rejected suggestions, pending reviews
    - Successfully validated datasets
    - Average dataset quality score
    - Real quality score trend for analyzed datasets
    - Real error distribution breakdown
    """
    total_datasets = db.query(Dataset).count()
    total_errors_detected = db.query(Issue).count()
    open_issues = db.query(Issue).filter(Issue.status == "detected").count()
    accepted_repairs = db.query(Issue).filter(Issue.status == "accepted").count()
    rejected_suggestions = db.query(Issue).filter(Issue.status == "rejected").count()
    errors_repaired = db.query(Issue).filter(Issue.status.in_(["accepted", "auto_fixed"])).count()
    pending_reviews = db.query(Issue).filter(
        Issue.status == "detected",
        (Issue.suggested_value.like("%review%") | Issue.suggested_value.like("%Cannot safely%"))
    ).count()
    successfully_validated_repairs = db.query(Dataset).filter(Dataset.status == "validated").count()

    # Calculate average quality score across analyzed datasets
    analyzed_datasets = (
        db.query(Dataset)
        .filter(Dataset.quality_score_before.isnot(None))
        .order_by(Dataset.upload_date.desc())
        .all()
    )
    scores = []
    for d in analyzed_datasets:
        if d.quality_score_after is not None:
            scores.append(d.quality_score_after)
        elif d.quality_score_before is not None:
            scores.append(d.quality_score_before)

    avg_score = round(sum(scores) / len(scores), 1) if scores else 100.0

    # Build quality score trend for up to 6 most recent analyzed datasets
    recent_trend = [
        {
            "dataset_name": (d.original_filename or d.filename)[:16],
            "quality_score": round(d.quality_score_after or d.quality_score_before or 0.0, 1),
            "initial_score": round(d.quality_score_before or 0.0, 1),
            "status": d.status,
        }
        for d in reversed(analyzed_datasets[:6])
    ]

    # Real error distribution by category
    CAT_NAME_MAP = {
        "missing_value": "Missing Values",
        "duplicate": "Duplicates",
        "invalid_format": "Invalid Formats",
        "inconsistency": "Inconsistencies",
        "anomaly": "Anomalies",
    }
    cat_query = db.query(Issue.issue_type, func.count(Issue.id)).group_by(Issue.issue_type).all()
    dist_map = {name: 0 for name in CAT_NAME_MAP.values()}
    for itype, cnt in cat_query:
        label = CAT_NAME_MAP.get(itype, itype.replace("_", " ").title())
        dist_map[label] = dist_map.get(label, 0) + cnt

    error_distribution = [{"category": k, "count": v} for k, v in dist_map.items()]

    return StatsResponse(
        total_datasets=total_datasets,
        total_errors=total_errors_detected,
        total_errors_detected=total_errors_detected,
        open_issues=open_issues,
        accepted_repairs=accepted_repairs,
        rejected_suggestions=rejected_suggestions,
        pending_reviews=pending_reviews,
        successfully_validated_repairs=successfully_validated_repairs,
        errors_repaired=errors_repaired,
        avg_quality_score=avg_score,
        average_quality_score=avg_score,
        recent_quality_trend=recent_trend,
        error_distribution=error_distribution,
    )
