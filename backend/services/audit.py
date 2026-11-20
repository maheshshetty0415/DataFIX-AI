from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from backend.database import AuditLog


def record_action(
    db: Session,
    dataset_id: str,
    column_name: Optional[str],
    row_number: Optional[int],
    original_value: Optional[str],
    new_value: Optional[str],
    reason: str,
    confidence: float,
    user_decision: str,  # 'accepted', 'rejected', 'auto'
    issue_type: str,
) -> AuditLog:
    """Record an individual repair decision or auto-repair action into audit log."""
    log_entry = AuditLog(
        dataset_id=dataset_id,
        column_name=column_name,
        row_number=row_number,
        original_value=str(original_value) if original_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        reason=reason,
        confidence=float(confidence),
        timestamp=datetime.utcnow(),
        user_decision=user_decision,
        issue_type=issue_type,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def get_audit_log(db: Session, dataset_id: str) -> List[AuditLog]:
    """Retrieve full chronological audit history for a dataset."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.dataset_id == dataset_id)
        .order_by(AuditLog.timestamp.desc())
        .all()
    )


def get_audit_summary(db: Session, dataset_id: str) -> Dict[str, Any]:
    """Summarize audit history by decision status and issue category."""
    logs = get_audit_log(db, dataset_id)
    by_decision: Dict[str, int] = {}
    by_issue_type: Dict[str, int] = {}

    for entry in logs:
        dec = entry.user_decision or "unknown"
        by_decision[dec] = by_decision.get(dec, 0) + 1

        itype = entry.issue_type or "unknown"
        by_issue_type[itype] = by_issue_type.get(itype, 0) + 1

    return {
        "dataset_id": dataset_id,
        "total_actions": len(logs),
        "by_decision": by_decision,
        "by_issue_type": by_issue_type,
        "logs": logs,
    }
