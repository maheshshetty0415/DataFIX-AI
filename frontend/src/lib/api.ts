import axios from 'axios';

// Base API Axios instance (calls /api/* routed through Next.js rewrites)
const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// TypeScript interfaces
export interface Dataset {
  id: string;
  name: string;
  filename?: string;
  original_filename?: string;
  upload_date: string;
  row_count: number;
  total_rows?: number;
  column_count: number;
  total_columns?: number;
  error_count: number;
  quality_score: number;
  quality_score_before?: number;
  quality_score_after?: number;
  status: 'pending' | 'uploaded' | 'analyzing' | 'analyzed' | 'repairing' | 'repaired' | 'validated' | string;
}

export interface DatasetPreview {
  id: string;
  filename?: string;
  original_filename?: string;
  name?: string;
  total_rows: number;
  total_columns: number;
  columns: string[];
  column_types?: Record<string, string>;
  missing_values?: Record<string, number>;
  rows: Record<string, any>[];
  preview_rows?: Record<string, any>[];
  dataset?: any;
}

export interface Issue {
  id: string;
  dataset_id: string;
  row_index: number;
  row_number?: number;
  column_name: string;
  issue_type: string;
  original_value: any;
  suggested_value?: any;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  suggested_action: string;
  status: 'detected' | 'pending' | 'accepted' | 'rejected' | 'auto_fixed' | string;
  confidence: number;
  explanation?: string;
}

export interface IssueSummary {
  total: number;
  missing_values: number;
  duplicates: number;
  invalid_formats: number;
  inconsistencies: number;
  anomalies: number;
}

export interface ColumnProfile {
  name: string;
  data_type?: string;
  type?: string;
  missing_count?: number;
  null_count?: number;
  missing_percentage?: number;
  null_percentage?: number;
  unique_count: number;
  sample_values: any[];
  min?: any;
  max?: any;
  mean?: any;
  stats?: Record<string, any>;
}

export interface DataProfile {
  dataset_id: string;
  total_rows: number;
  total_columns: number;
  quality_score?: number;
  columns: ColumnProfile[] | Record<string, ColumnProfile>;
}

export interface ModifiedRecord {
  id?: string;
  row_index: number;
  row_number?: number;
  column_name: string;
  original_value: any;
  new_value: any;
  change_type: string;
  repair_method?: string;
  confidence?: number;
  status?: string;
  is_deletion?: boolean;
  is_addition?: boolean;
  timestamp?: string;
}

export interface CategoryComparisonItem {
  category: string;
  before: number;
  after: number;
  fixed: number;
  'Before Repair'?: number;
  'After Repair'?: number;
}

export interface ComparisonData {
  dataset_id: string;
  original_rows: number;
  cleaned_rows: number;
  original_errors: number;
  remaining_errors: number;
  quality_score_before: number;
  quality_score_after: number;
  score_improvement?: number;
  issues_by_category_before: Record<string, number>;
  issues_by_category_after: Record<string, number>;
  category_comparison?: CategoryComparisonItem[];
  modified_records: ModifiedRecord[];
  deleted_rows?: ModifiedRecord[];
  validation_status?: string;
  validation_passed?: boolean;
  pending_reviews_count?: number;
  critical_issues_count?: number;
  trust_status?: string;
  original_preview?: Record<string, any>[];
  cleaned_preview?: Record<string, any>[];
  original_columns?: string[];
  cleaned_columns?: string[];
  changes_summary?: Record<string, any>;
}

export interface AuditEntry {
  id: string;
  dataset_id: string;
  dataset_name?: string;
  column_name: string;
  row_index: number;
  original_value: any;
  new_value: any;
  reason: string;
  confidence: number;
  timestamp: string;
  decision: 'Accepted' | 'Rejected' | 'Auto' | string;
  issue_type?: string;
}

export interface StatsResponse {
  total_datasets: number;
  total_errors_detected: number;
  errors_repaired: number;
  average_quality_score: number;
  open_issues?: number;
  accepted_repairs?: number;
  rejected_suggestions?: number;
  pending_reviews?: number;
  successfully_validated_repairs?: number;
  recent_quality_trend?: { dataset_name: string; quality_score: number; initial_score?: number; status?: string }[];
  error_distribution?: { category: string; count: number }[];
}

export interface ValidationResult {
  valid: boolean;
  score: number;
  message: string;
  remaining_issues: number;
  passed_checks: string[];
  warnings: string[];
  details?: { check_name: string; passed: boolean; message: string }[];
}

// Helpers for data normalization
function normalizePreview(data: any): DatasetPreview {
  const ds = data.dataset || {};
  const id = String(data.id || ds.id || '');
  const rows = data.preview_rows || data.rows || [];
  let columns = data.columns || [];
  if (columns.length === 0 && rows.length > 0) {
    columns = Object.keys(rows[0]);
  }
  const missing_values: Record<string, number> = data.missing_values || {};
  const column_types: Record<string, string> = data.column_types || {};

  if (Object.keys(missing_values).length === 0 && rows.length > 0) {
    for (const col of columns) {
      let nulls = 0;
      for (const r of rows) {
        if (r[col] === null || r[col] === undefined || r[col] === '') nulls++;
      }
      missing_values[col] = nulls;
      const sampleVal = rows.find((r: any) => r[col] !== null && r[col] !== undefined)?.[col];
      column_types[col] = typeof sampleVal === 'number' ? 'number' : 'string';
    }
  }

  return {
    id,
    filename: ds.original_filename || ds.filename || data.filename,
    original_filename: ds.original_filename || data.original_filename,
    name: ds.original_filename || ds.filename || data.name || `Dataset #${id}`,
    total_rows: data.total_rows || ds.total_rows || rows.length,
    total_columns: data.total_columns || ds.total_columns || columns.length,
    columns,
    column_types,
    missing_values,
    rows,
    preview_rows: rows,
    dataset: ds,
  };
}

// Dataset Operations
export async function uploadDataset(
  file: File,
  onUploadProgress?: (progressEvent: any) => void
): Promise<DatasetPreview> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<any>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
  return normalizePreview(response.data);
}

export async function getDatasets(): Promise<Dataset[]> {
  const response = await apiClient.get<any[]>('/api/datasets');
  const items = response.data || [];
  return items.map((d: any) => {
    const rawScore = d.quality_score_after ?? d.quality_score_before ?? d.quality_score;
    return {
      ...d,
      id: String(d.id),
      name: d.original_filename || d.filename || d.name || `Dataset #${d.id}`,
      row_count: d.total_rows ?? d.row_count ?? 0,
      total_rows: d.total_rows ?? d.row_count ?? 0,
      column_count: d.total_columns ?? d.column_count ?? 0,
      total_columns: d.total_columns ?? d.column_count ?? 0,
      error_count: d.error_count ?? 0,
      quality_score: rawScore !== null && rawScore !== undefined ? Math.round(rawScore) : 100,
      status: d.status || 'uploaded',
    };
  });
}

export async function getDataset(id: string | number): Promise<Dataset> {
  const response = await apiClient.get<any>(`/api/datasets/${id}`);
  const d = response.data?.dataset || response.data;
  const rawScore = d.quality_score_after ?? d.quality_score_before ?? d.quality_score;
  return {
    ...d,
    id: String(d.id),
    name: d.original_filename || d.filename || d.name || `Dataset #${d.id}`,
    row_count: d.total_rows ?? d.row_count ?? 0,
    total_rows: d.total_rows ?? d.row_count ?? 0,
    column_count: d.total_columns ?? d.column_count ?? 0,
    total_columns: d.total_columns ?? d.column_count ?? 0,
    error_count: d.error_count ?? 0,
    quality_score: rawScore !== null && rawScore !== undefined ? Math.round(rawScore) : 100,
    status: d.status || 'uploaded',
  };
}

export async function getDatasetPreview(
  id: string | number,
  cleaned: boolean = false,
  limit: number = 250,
  offset: number = 0
): Promise<DatasetPreview> {
  const response = await apiClient.get<any>(`/api/datasets/${id}/preview`, {
    params: { cleaned, limit, offset },
  });
  return normalizePreview(response.data);
}

export async function loadSampleDataset(): Promise<DatasetPreview> {
  const response = await apiClient.post<any>('/api/datasets/sample');
  return normalizePreview(response.data);
}

export async function deleteDataset(id: string | number): Promise<{ success: boolean; message?: string }> {
  const response = await apiClient.delete(`/api/datasets/${id}`);
  return response.data;
}

// Analysis Operations
export async function analyzeDataset(id: string | number): Promise<{ success: boolean; issue_count: number; dataset_id: string }> {
  const response = await apiClient.post<any>(`/api/analyze/${id}`);
  return {
    success: true,
    issue_count: response.data?.total_issues ?? 0,
    dataset_id: String(response.data?.dataset_id || id),
  };
}

export async function getIssues(id: string | number, type?: string): Promise<Issue[]> {
  const params: Record<string, string> = {};
  if (type && type !== 'all') {
    params.type = type;
  }
  const response = await apiClient.get<any>(`/api/issues/${id}`, { params });
  const rawIssues = Array.isArray(response.data) ? response.data : (response.data?.issues || []);
  return rawIssues.map((i: any) => ({
    ...i,
    id: String(i.id),
    dataset_id: String(i.dataset_id || id),
    row_index: i.row_number ?? i.row_index ?? 0,
    row_number: i.row_number ?? i.row_index ?? 0,
    suggested_action:
      i.suggested_action ||
      (i.suggested_value ? `Replace with: ${i.suggested_value}` : 'Needs manual review'),
    status: i.status === 'auto_fixed' ? 'auto_repaired' : i.status,
  }));
}

export async function getProfile(id: string | number): Promise<DataProfile> {
  const response = await apiClient.get<any>(`/api/profile/${id}`);
  const data = response.data || {};
  return {
    dataset_id: String(data.dataset_id || id),
    total_rows: data.total_rows || 0,
    total_columns: data.total_columns || 0,
    quality_score: data.quality_score,
    columns: data.columns || [],
  };
}

// Repair Operations
export async function acceptRepair(
  datasetId: string | number,
  issueId: string | number
): Promise<{ success: boolean; issue?: Issue }> {
  const response = await apiClient.post(`/api/repair/${datasetId}/accept/${issueId}`);
  return response.data;
}

export async function rejectRepair(
  datasetId: string | number,
  issueId: string | number
): Promise<{ success: boolean; issue?: Issue }> {
  const response = await apiClient.post(`/api/repair/${datasetId}/reject/${issueId}`);
  return response.data;
}

export async function autoRepair(
  datasetId: string | number
): Promise<{ success: boolean; repaired_count: number; remaining_count: number }> {
  const response = await apiClient.post<any>(`/api/repair/${datasetId}/auto`);
  return {
    success: response.data?.success ?? true,
    repaired_count: response.data?.repaired_count ?? 0,
    remaining_count: response.data?.remaining_issues ?? 0,
  };
}

export async function validateDataset(datasetId: string | number): Promise<ValidationResult> {
  const response = await apiClient.post<any>(`/api/repair/${datasetId}/validate`);
  const data = response.data || {};
  const details = data.details || [];
  return {
    valid: data.validation_passed ?? true,
    score: data.quality_score_after ?? 100,
    message: data.row_count_explanation || (data.validation_passed ? 'Validation succeeded with no structural regressions.' : 'Validation flagged issues.'),
    remaining_issues: data.remaining_issues_count ?? 0,
    passed_checks: details.filter((d: any) => d.passed).map((d: any) => d.check_name),
    warnings: details.filter((d: any) => !d.passed).map((d: any) => `${d.check_name}: ${d.message}`),
    details,
  };
}

export async function getComparison(datasetId: string | number): Promise<ComparisonData> {
  const response = await apiClient.get<any>(`/api/compare/${datasetId}`);
  const data = response.data || {};
  const cs = data.changes_summary || {};

  const issuesByCategoryBefore: Record<string, number> = data.issues_by_category_before || {};
  const issuesByCategoryAfter: Record<string, number> = data.issues_by_category_after || {};

  const rawCategoryComparison: any[] = data.category_comparison || [];
  const categoryComparison: CategoryComparisonItem[] = rawCategoryComparison.map((c: any) => ({
    category: c.category,
    before: c.before ?? c['Before Repair'] ?? 0,
    after: c.after ?? c['After Repair'] ?? 0,
    fixed: c.fixed ?? 0,
    'Before Repair': c.before ?? c['Before Repair'] ?? 0,
    'After Repair': c.after ?? c['After Repair'] ?? 0,
  }));

  const rawModified = data.modified_records || [];
  const modifiedRecords: ModifiedRecord[] = rawModified.map((m: any, idx: number) => ({
    ...m,
    id: m.id || `mod-${idx}`,
    row_index: m.row_number ?? m.row_index ?? 0,
    row_number: m.row_number ?? m.row_index ?? 0,
    column_name: m.column_name || 'Entire Row',
    confidence: m.confidence ?? 100,
    status: m.status || 'Auto-repaired',
    change_type: m.change_type || 'Value Rectification',
    repair_method: m.repair_method || 'Applied correction',
  }));

  const rawDeleted = data.deleted_rows || [];
  const deletedRows: ModifiedRecord[] = rawDeleted.map((d: any, idx: number) => ({
    ...d,
    id: d.id || `del-${idx}`,
    row_index: d.row_number ?? d.row_index ?? 0,
    row_number: d.row_number ?? d.row_index ?? 0,
    column_name: d.column_name || 'Entire Row',
    confidence: d.confidence ?? 100,
    status: d.status || 'Auto-repaired',
    change_type: d.change_type || 'Duplicate Removal',
    repair_method: d.repair_method || 'Removed duplicate row',
    is_deletion: true,
  }));

  return {
    dataset_id: String(data.dataset_id || datasetId),
    original_rows: data.original_row_count ?? cs.original_rows ?? 0,
    cleaned_rows: data.cleaned_row_count ?? cs.cleaned_rows ?? 0,
    original_errors: data.total_issues_detected ?? 0,
    remaining_errors: data.remaining_issues ?? 0,
    quality_score_before: data.quality_score_before ?? 0,
    quality_score_after: data.quality_score_after ?? 0,
    score_improvement: data.score_improvement ?? 0,
    issues_by_category_before: issuesByCategoryBefore,
    issues_by_category_after: issuesByCategoryAfter,
    category_comparison: categoryComparison,
    modified_records: modifiedRecords,
    deleted_rows: deletedRows,
    validation_status: data.validation_status || data.trust_status || 'Pending Remediation',
    validation_passed: data.validation_passed ?? false,
    pending_reviews_count: data.pending_reviews_count ?? 0,
    critical_issues_count: data.critical_issues_count ?? 0,
    trust_status: data.trust_status || data.validation_status || 'Pending Remediation',
    original_preview: data.original_preview || [],
    cleaned_preview: data.cleaned_preview || [],
    original_columns: data.original_columns || [],
    cleaned_columns: data.cleaned_columns || [],
    changes_summary: cs,
  };
}

// Reports & Audit Operations
export async function getAuditLog(datasetId: string | number): Promise<AuditEntry[]> {
  const response = await apiClient.get<any>(`/api/audit/${datasetId}`);
  const rawLogs = Array.isArray(response.data) ? response.data : (response.data?.logs || []);
  return rawLogs.map((log: any) => {
    let dec = log.user_decision || 'accepted';
    dec = dec.charAt(0).toUpperCase() + dec.slice(1);
    return {
      id: String(log.id),
      dataset_id: String(log.dataset_id || datasetId),
      column_name: log.column_name || 'Row',
      row_index: log.row_number ?? 0,
      original_value: log.original_value,
      new_value: log.new_value,
      reason: log.reason,
      confidence: log.confidence ?? 1.0,
      timestamp: log.timestamp,
      decision: dec,
      issue_type: log.issue_type,
    };
  });
}

export async function getStats(): Promise<StatsResponse> {
  const response = await apiClient.get<any>('/api/stats');
  const d = response.data || {};
  return {
    total_datasets: d.total_datasets ?? 0,
    total_errors_detected: d.total_errors_detected ?? d.total_errors ?? 0,
    errors_repaired: d.errors_repaired ?? 0,
    average_quality_score: d.average_quality_score ?? d.avg_quality_score ?? 100,
    open_issues: d.open_issues ?? 0,
    accepted_repairs: d.accepted_repairs ?? 0,
    rejected_suggestions: d.rejected_suggestions ?? 0,
    pending_reviews: d.pending_reviews ?? 0,
    successfully_validated_repairs: d.successfully_validated_repairs ?? 0,
    recent_quality_trend: d.recent_quality_trend || [],
    error_distribution: d.error_distribution || [],
  };
}

// Export URLs for direct downloads
export function exportCSV(datasetId: string | number): string {
  return `/api/export/${datasetId}/csv`;
}

export function exportExcel(datasetId: string | number): string {
  return `/api/export/${datasetId}/excel`;
}

export function exportPDF(datasetId: string | number): string {
  return `/api/export/${datasetId}/pdf`;
}

export function exportAuditCSV(datasetId: string | number): string {
  return `/api/export/${datasetId}/audit-csv`;
}
