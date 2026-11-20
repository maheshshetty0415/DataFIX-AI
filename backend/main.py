import os
import sys

# Ensure project root is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_current_dir)
if _parent_dir not in sys.path:
    sys.path.insert(0, _parent_dir)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.database import init_db
from backend.routes.upload import router as upload_router
from backend.routes.analysis import router as analysis_router
from backend.routes.repair import router as repair_router
from backend.routes.reports import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite database tables
    init_db()
    yield
    # Shutdown logic if needed


app = FastAPI(
    title="DataFix AI — Autonomous Data Quality & Repair Engine",
    description="Intelligent API backend for detecting, scoring, and repairing data quality defects autonomously.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for developer ease and frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(upload_router)
app.include_router(analysis_router)
app.include_router(repair_router)
app.include_router(reports_router)


@app.get("/", tags=["General"])
def root():
    """Root endpoint returning API metadata and health status."""
    return {
        "name": "DataFix AI API",
        "description": "Autonomous Data Quality & Repair Engine",
        "version": "1.0.0",
        "status": "online",
        "endpoints": {
            "upload": "/api/upload",
            "datasets": "/api/datasets",
            "sample": "/api/datasets/sample",
            "analyze": "/api/analyze/{dataset_id}",
            "issues": "/api/issues/{dataset_id}",
            "profile": "/api/profile/{dataset_id}",
            "auto_repair": "/api/repair/{dataset_id}/auto",
            "accept_repair": "/api/repair/{dataset_id}/accept/{issue_id}",
            "reject_repair": "/api/repair/{dataset_id}/reject/{issue_id}",
            "validate": "/api/repair/{dataset_id}/validate",
            "compare": "/api/compare/{dataset_id}",
            "audit": "/api/audit/{dataset_id}",
            "export_csv": "/api/export/{dataset_id}/csv",
            "export_excel": "/api/export/{dataset_id}/excel",
            "export_pdf": "/api/export/{dataset_id}/pdf",
            "stats": "/api/stats",
        },
    }


@app.get("/api/health", tags=["General"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "app": "DataFix AI Backend"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
