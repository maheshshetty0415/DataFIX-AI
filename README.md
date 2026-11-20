# DataFix AI — Autonomous Data Quality & Repair Engine

> **Turn Messy Data Into Reliable Data.**  
> An intelligent data quality and repair platform that detects, diagnoses, and fixes dataset errors while keeping every single change transparent, explainable, and fully traceable.

---

## 🌟 Executive Summary

In real-world data engineering and analytics pipelines, garbage in is garbage out. Machine learning models, executive dashboards, and database synchronizations fail repeatedly because of dirty tabular data:
- Missing entries in critical features
- Silent duplicate records skewing statistics
- Formatting discrepancies (e.g. malformed emails, broken phone numbers, ambiguous dates)
- Casing and whitespace inconsistencies
- Statistical anomalies and severe outliers

**DataFix AI** provides an autonomous, multi-tier diagnostic engine and an interactive **AI Repair Centre** that detects defects with mathematical and rule-based precision, suggests verified fixes, supports autonomous or human-in-the-loop decisions, and logs an immutable audit trail without ever silently corrupting or modifying original source datasets.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend UI / UX** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide React, Recharts, Framer Motion, Axios, React Hot Toast |
| **Backend API** | Python 3.11, FastAPI, Uvicorn, Pandas, NumPy, Scikit-learn, OpenPyXL, XLRD, ReportLab, Pydantic v2 |
| **Database & ORM** | SQLite, SQLAlchemy 2.0 (Models: `Dataset`, `Issue`, `AuditLog`) |
| **Export Formats** | RFC 4180 CSV, Microsoft Excel (.xlsx), Executive PDF Quality Certification (ReportLab), Audit CSV |

---

## 🏗️ System Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │            DataFix AI Web Client             │
                    │      Next.js 14 App Router + Tailwind UI     │
                    └──────────────────────┬───────────────────────┘
                                           │ Next.js Proxy (/api/*)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │               FastAPI Backend                │
                    │            (Port 8000 / SQLite)              │
                    └──────┬───────────────┬────────────────┬──────┘
                           │               │                │
            ┌──────────────▼────┐   ┌──────▼──────┐   ┌─────▼─────────────┐
            │   Error Detector  │   │Repair Engine│   │ Quality Profiler  │
            │  5-Layer Pipeline │   │Non-destruct │   │& Report Generator │
            └───────────────────┘   └─────────────┘   └───────────────────┘
```

---

## 📋 5-Layer Detection Pipeline

1. **Missing Value Detection**: Automatically identifies empty, whitespace-only, and NaN cells across numerical and categorical features. Suggests median imputation for numeric attributes and mode imputation for categorical attributes.
2. **Exact Duplicate Identification**: Scans and isolates duplicate rows across all dimensions. Suggests verified row deduping.
3. **Invalid Format Verification**: Strict regex validation on email addresses, parseable date normalization (e.g., ISO-8601 vs localized dates), phone number length/character rules, and domain-constraint checks (e.g., negative ages).
4. **Inconsistency Resolution**: Uncovers trailing/leading whitespace and mixed-casing variations in categorical values (e.g., `'new york'`, `'New York'`, `'NEW YORK'`). Standardizes to dominant casing patterns.
5. **Statistical Anomaly Detection**: Interquartile Range ($IQR$) bounds:
   $$\text{Lower Bound} = Q_1 - 1.5 \times IQR, \quad \text{Upper Bound} = Q_3 + 1.5 \times IQR$$
   Flags extreme statistical deviations for review without fabricating artificial values.

---

## 📐 Transparent Quality Score Formula

DataFix AI computes an objective, normalized quality score from $0$ to $100\%$:

$$\text{Score} = \max\left(0, 100 \times \left(1 - \frac{\sum w_i}{\text{Total Cells}}\right)\right)$$

Where severity weights $w_i$ are assigned as:
- **Critical**: $-3.0$ points per defect (e.g. invalid types, negative ages)
- **High**: $-2.0$ points per defect (e.g. missing required emails)
- **Medium**: $-1.0$ points per defect (e.g. casing/whitespace inconsistencies)
- **Low**: $-0.5$ points per defect (e.g. minor outliers)

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js 18+ & npm
- Python 3.10+ (or Python 3.11)

### 1. Backend Setup & Startup
```powershell
# Navigate to project root
cd C:\Users\MaheshNew\.gemini\antigravity\scratch\datafix-ai

# Install backend dependencies
python -m pip install -r backend/requirements.txt

# Start the FastAPI server (Port 8000)
python -m backend.main
```
The backend API documentation is interactively available at:
- Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### 2. Frontend Setup & Startup
```powershell
# Navigate to frontend folder
cd C:\Users\MaheshNew\.gemini\antigravity\scratch\datafix-ai\frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Open your browser at:
`http://localhost:3000`

---

## 🧪 Demonstration Acceptance Workflow

1. **Homepage (`/`)**: Click **"Get Started"** or **"Explore Demo"**.
2. **Ingest (`/upload`)**: Click **"Try Sample Dataset"** to load the built-in benchmark dataset (`sample_customers.csv`).
3. **Inspect Raw Matrix**: Review the instant 20-row preview with detected columns, missing counts, and inferred data types.
4. **Run Diagnostics (`/analysis`)**: Click **"Analyse Dataset"** to run the 5-layer anomaly engine. Filter by Missing Values, Duplicates, Formats, Inconsistencies, or Anomalies.
5. **AI Repair Centre (`/repair`)**:
   - Inspect individual proposed repairs with machine confidence and explanations.
   - Click **Accept** or **Reject** on individual items.
   - Click **"Auto Repair Safe Issues"** to batch-repair safe errors (whitespace, casing, deduplication, imputation).
   - Click **"Validate Dataset"** to verify structural integrity and schema consistency.
6. **Before & After (`/compare`)**: Review side-by-side matrices, differential error counts, and the before/after quality score improvement.
7. **Audit Lineage (`/audit`)**: Inspect the complete modification history containing timestamps, decisions, original values, and reasons.
8. **Export Centre (`/reports`)**: Download:
   - Cleaned Dataset as **CSV**
   - Cleaned Spreadsheet as **Excel (.xlsx)**
   - Audit Lineage Log as **CSV**
   - Certified Quality Report as **PDF**

---

## 🔒 Safety & Data Integrity Guarantees

1. **Non-Destructive Operations**: Uploaded raw datasets are stored strictly in `backend/uploads/` as immutable originals. All repairs operate strictly on isolated working copies in `backend/cleaned/{dataset_id}_cleaned.csv`.
2. **No Data Fabrication**: Anomaly values are flagged for review rather than replaced with invented numbers. Missing identifier columns are never auto-imputed.
3. **Traceability**: Every accepted or autonomous correction logs an immutable audit event in SQLite.
