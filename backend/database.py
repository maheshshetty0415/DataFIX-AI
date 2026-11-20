import os
import uuid
from datetime import datetime
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    Float,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from dotenv import load_dotenv

load_dotenv()

# Determine database URL. If relative SQLite path, ensure it resolves properly.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "datafix.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_rows = Column(Integer, default=0, nullable=False)
    total_columns = Column(Integer, default=0, nullable=False)
    file_size = Column(Integer, default=0, nullable=False)  # in bytes
    status = Column(
        String(50),
        default="uploaded",
        nullable=False
    )  # uploaded, analyzing, analyzed, repairing, repaired, validated
    quality_score_before = Column(Float, nullable=True)
    quality_score_after = Column(Float, nullable=True)

    issues = relationship("Issue", back_populates="dataset", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="dataset", cascade="all, delete-orphan")


class Issue(Base):
    __tablename__ = "issues"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    issue_type = Column(String(50), nullable=False)  # missing_value, duplicate, invalid_format, inconsistency, anomaly
    column_name = Column(String(100), nullable=True)
    row_number = Column(Integer, nullable=False)  # 0-indexed from data rows
    original_value = Column(Text, nullable=True)
    suggested_value = Column(Text, nullable=True)
    description = Column(Text, nullable=False)
    severity = Column(String(20), default="medium", nullable=False)  # low, medium, high, critical
    confidence = Column(Float, default=1.0, nullable=False)
    status = Column(String(20), default="detected", nullable=False)  # detected, accepted, rejected, auto_fixed
    explanation = Column(Text, nullable=True)

    dataset = relationship("Dataset", back_populates="issues")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    column_name = Column(String(100), nullable=True)
    row_number = Column(Integer, nullable=True)
    original_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    reason = Column(Text, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_decision = Column(String(20), nullable=False)  # accepted, rejected, auto
    issue_type = Column(String(50), nullable=False)

    dataset = relationship("Dataset", back_populates="audit_logs")


def init_db():
    """Create all tables in the database if they don't already exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for yielding database session with automatic cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
