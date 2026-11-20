'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  CheckCircle,
  XCircle,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  Database,
  ArrowRight,
  RefreshCw,
  Sliders,
  HelpCircle,
  FileCheck2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getDatasets,
  getIssues,
  acceptRepair,
  rejectRepair,
  autoRepair,
  validateDataset,
  Dataset,
  Issue,
  ValidationResult,
} from '@/lib/api';
import DatasetDropdown from '@/components/DatasetDropdown';

export default function RepairPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get('dataset');

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    datasetParam || null
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [autoRepairing, setAutoRepairing] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showAutoConfirmModal, setShowAutoConfirmModal] = useState<boolean>(false);

  // Load datasets list
  useEffect(() => {
    async function loadDatasets() {
      try {
        const list = await getDatasets();
        setDatasets(list || []);
        if (!selectedDatasetId && list && list.length > 0) {
          setSelectedDatasetId(list[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load datasets:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDatasets();
  }, []);

  // Update selectedDatasetId when url param updates
  useEffect(() => {
    if (datasetParam) {
      setSelectedDatasetId(datasetParam);
    }
  }, [datasetParam]);

  // Load issues for the current dataset
  const fetchIssues = async () => {
    if (!selectedDatasetId) return;
    const currentId = selectedDatasetId;
    setLoading(true);
    try {
      const data = await getIssues(currentId);
      setIssues(data || []);
    } catch (err: any) {
      console.error('Failed to fetch issues:', err);
      toast.error('Unable to fetch repair tasks for this dataset');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [selectedDatasetId]);

  // Accept a single repair
  const handleAccept = async (issueId: string) => {
    if (!selectedDatasetId) return;
    setActionInProgress(issueId);
    try {
      await acceptRepair(selectedDatasetId, issueId);
      toast.success('Repair accepted and applied!');
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, status: 'accepted' } : i))
      );
    } catch (err: any) {
      console.error('Accept repair failed:', err);
      toast.error('Failed to accept repair suggestion');
    } finally {
      setActionInProgress(null);
    }
  };

  // Reject a single repair
  const handleReject = async (issueId: string) => {
    if (!selectedDatasetId) return;
    setActionInProgress(issueId);
    try {
      await rejectRepair(selectedDatasetId, issueId);
      toast.success('Repair suggestion rejected.');
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, status: 'rejected' } : i))
      );
    } catch (err: any) {
      console.error('Reject repair failed:', err);
      toast.error('Failed to reject repair suggestion');
    } finally {
      setActionInProgress(null);
    }
  };

  // Auto Repair all safe issues
  const handleAutoRepair = async () => {
    if (!selectedDatasetId) return;
    setShowAutoConfirmModal(false);
    setAutoRepairing(true);
    try {
      const res = await autoRepair(selectedDatasetId);
      toast.success(
        `Auto repair complete! Repaired ${res.repaired_count || 'all high-confidence'} records.`
      );
      await fetchIssues();
    } catch (err: any) {
      console.error('Auto repair error:', err);
      toast.error('Auto repair failed. Check server logs.');
    } finally {
      setAutoRepairing(false);
    }
  };

  // Validate Dataset
  const handleValidate = async () => {
    if (!selectedDatasetId) return;
    setValidating(true);
    try {
      const result = await validateDataset(selectedDatasetId);
      setValidationResult(result);
      toast.success('Validation completed successfully!');
    } catch (err: any) {
      console.error('Validation error:', err);
      toast.error('Dataset validation failed.');
    } finally {
      setValidating(false);
    }
  };

  // Compute summary stats
  const totalIssues = issues.length;
  const pendingCount = issues.filter((i) => !i.status || i.status === 'pending').length;
  const acceptedCount = issues.filter(
    (i) => i.status === 'accepted' || i.status === 'auto_repaired'
  ).length;
  const rejectedCount = issues.filter((i) => i.status === 'rejected').length;

  const handleDatasetDeleted = (deletedId: string) => {
    const remaining = datasets.filter((d) => String(d.id) !== String(deletedId));
    setDatasets(remaining);
    if (String(selectedDatasetId) === String(deletedId)) {
      if (remaining.length > 0) {
        setSelectedDatasetId(remaining[0].id);
        router.push(`/repair?dataset=${remaining[0].id}`);
      } else {
        setSelectedDatasetId(null);
        setIssues([]);
        router.push('/repair');
      }
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header & Dataset Selection */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-300 border border-purple-500/30">
              Autonomous Core
            </span>
            <span className="text-xs text-gray-400">Zero Data Loss Engine</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2">
            AI Repair Centre
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Review machine learning repair suggestions, inspect imputed values, and execute autonomous batch remediation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {datasets.length > 0 && (
            <DatasetDropdown
              datasets={datasets}
              selectedDatasetId={selectedDatasetId}
              onSelect={(val) => {
                setSelectedDatasetId(val);
                router.push(`/repair?dataset=${val}`);
              }}
              onDatasetDeleted={handleDatasetDeleted}
            />
          )}

          {selectedDatasetId && (
            <>
              <button
                onClick={() => setShowAutoConfirmModal(true)}
                disabled={autoRepairing || pendingCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50"
              >
                {autoRepairing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                )}
                Auto Repair Safe Issues
              </button>

              <button
                onClick={handleValidate}
                disabled={validating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 border border-emerald-500/30 text-emerald-400 font-semibold text-xs transition-all disabled:opacity-50"
              >
                {validating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                Validate Dataset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty State if no dataset */}
      {!selectedDatasetId && !loading && (
        <div className="p-12 text-center rounded-2xl bg-navy-800/80 border border-navy-700/80">
          <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No Dataset Active</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Please choose a dataset to inspect and apply machine learning data repairs.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/upload"
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              Upload Dataset
            </Link>
          </div>
        </div>
      )}

      {selectedDatasetId && (
        <>
          {/* Repair Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs font-semibold uppercase text-gray-400">Total Issues</span>
              <p className="text-2xl font-bold text-white mt-1">{totalIssues}</p>
            </div>
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs font-semibold uppercase text-amber-400">Pending Review</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">{pendingCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs font-semibold uppercase text-emerald-400">Accepted Repairs</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{acceptedCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs font-semibold uppercase text-red-400">Rejected Suggestions</span>
              <p className="text-2xl font-bold text-red-400 mt-1">{rejectedCount}</p>
            </div>
          </div>

          {/* Validation Result Banner (if run) */}
          {validationResult && (
            <div
              className={`p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                validationResult.valid
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    validationResult.valid
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">
                    {validationResult.valid
                      ? 'Dataset Validation Passed'
                      : 'Dataset Validation Warning'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">{validationResult.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span>
                      Integrity Score:{' '}
                      <strong className="font-bold">{validationResult.score}%</strong>
                    </span>
                    <span>
                      Remaining Issues: <strong>{validationResult.remaining_issues}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setValidationResult(null)}
                className="text-xs px-3 py-1.5 rounded bg-navy-800/80 hover:bg-navy-700 text-gray-300 self-end sm:self-center"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Issues List with Repair Actions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Repair Candidates & Suggestions</h3>
                <p className="text-xs text-gray-400">
                  Inspect algorithmic explanations, compare original vs proposed values, and accept or reject.
                </p>
              </div>
              <button
                onClick={fetchIssues}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh List
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400 rounded-xl bg-navy-800 border border-navy-700">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" />
                <p className="text-xs">Loading repair suggestions...</p>
              </div>
            ) : issues.length === 0 ? (
              <div className="p-12 text-center rounded-xl bg-navy-800 border border-navy-700">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-base font-bold text-white">Dataset in Pristine State</h4>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  No pending repair candidates found. View the before & after comparison or export
                  your cleaned dataset.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Link
                    href={`/compare?dataset=${selectedDatasetId}`}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    View Before & After
                  </Link>
                  <Link
                    href={`/reports?dataset=${selectedDatasetId}`}
                    className="px-4 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-gray-200 text-xs font-semibold"
                  >
                    Export Cleaned Dataset
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map((issue) => {
                  const isAccepted =
                    issue.status === 'accepted' || issue.status === 'auto_repaired';
                  const isRejected = issue.status === 'rejected';
                  const isPending = !isAccepted && !isRejected;
                  const confidence = Math.round((issue.confidence || 0.88) * 100);
                  const isBusy = actionInProgress === issue.id;

                  return (
                    <div
                      key={issue.id}
                      className={`p-5 rounded-xl border transition-all ${
                        isAccepted
                          ? 'bg-navy-800/50 border-emerald-500/30'
                          : isRejected
                          ? 'bg-navy-800/40 border-red-500/20 opacity-75'
                          : 'bg-navy-800 border-navy-700/80 hover:border-navy-600'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left Details */}
                        <div className="space-y-3 flex-1 min-w-0">
                          {/* Top Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {issue.issue_type?.replace(/_/g, ' ') || 'Anomaly'}
                            </span>
                            <span className="text-xs font-mono font-bold text-white bg-navy-900 px-2.5 py-0.5 rounded border border-navy-700">
                              Column: {issue.column_name}
                            </span>
                            <span className="text-xs font-mono text-gray-400 bg-navy-900 px-2 py-0.5 rounded border border-navy-700">
                              Row #{issue.row_index}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                issue.severity === 'Critical'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {issue.severity || 'Medium'} Severity
                            </span>
                          </div>

                          {/* Value Comparison */}
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400">Original:</span>
                              <span className="px-2 py-1 rounded font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20 line-through">
                                {issue.original_value === null || issue.original_value === undefined
                                  ? '<null>'
                                  : String(issue.original_value)}
                              </span>
                            </div>

                            <ArrowRight className="w-3.5 h-3.5 text-gray-500" />

                            {(() => {
                              const isUnreconstructible =
                                !issue.suggested_value ||
                                String(issue.suggested_value).includes('Cannot safely reconstruct') ||
                                String(issue.suggested_value).startsWith('Needs manual review') ||
                                String(issue.suggested_value).startsWith('Flagged for review');

                              return (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-400">Suggested:</span>
                                  <span
                                    className={`px-2 py-1 rounded font-mono font-bold border ${
                                      isUnreconstructible
                                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    }`}
                                  >
                                    {issue.suggested_value !== undefined && issue.suggested_value !== null
                                      ? String(issue.suggested_value)
                                      : 'Normalized Record'}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Explanation & Transparency */}
                          {issue.explanation && issue.explanation.includes('|') ? (
                            <div className="mt-1 space-y-1 text-xs">
                              {issue.explanation.split('|').map((part: string, pIdx: number) => {
                                const colonIdx = part.indexOf(':');
                                if (colonIdx > -1) {
                                  const key = part.slice(0, colonIdx).trim();
                                  const val = part.slice(colonIdx + 1).trim();
                                  return (
                                    <div key={pIdx} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                                      <span className="text-[10px] uppercase font-bold text-blue-400 shrink-0 font-mono">
                                        {key}:
                                      </span>
                                      <span className="text-gray-300 text-xs">{val}</span>
                                    </div>
                                  );
                                }
                                return <p key={pIdx} className="text-gray-300 text-xs">{part.trim()}</p>;
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-300 leading-relaxed">
                              {issue.explanation ||
                                issue.description ||
                                'Autonomous repair imputation selected via Bayesian likelihood estimation across column co-occurrences.'}
                            </p>
                          )}

                          {/* Confidence Bar */}
                          <div className="flex items-center gap-3 pt-1">
                            <span className="text-[11px] text-gray-400 font-medium">Confidence:</span>
                            <div className="w-32 bg-navy-950 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-emerald-400 h-1.5 rounded-full"
                                style={{ width: `${confidence}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {confidence}%
                            </span>
                          </div>
                        </div>

                        {/* Right Action Buttons */}
                        {(() => {
                          const isUnreconstructible =
                            !issue.suggested_value ||
                            String(issue.suggested_value).includes('Cannot safely reconstruct') ||
                            String(issue.suggested_value).startsWith('Needs manual review') ||
                            String(issue.suggested_value).startsWith('Flagged for review');

                          return (
                            <div className="flex sm:flex-row lg:flex-col items-center justify-end gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-navy-700/60">
                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleAccept(issue.id)}
                                    disabled={isBusy || isUnreconstructible}
                                    title={
                                      isUnreconstructible
                                        ? 'Cannot automatically apply: manual verification required.'
                                        : 'Apply suggested repair'
                                    }
                                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {isBusy ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                    {isUnreconstructible ? 'Manual Only' : 'Accept'}
                                  </button>
                                  <button
                                    onClick={() => handleReject(issue.id)}
                                    disabled={isBusy}
                                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-navy-700 hover:bg-red-600/20 text-red-400 hover:text-red-300 border border-navy-600 hover:border-red-500/40 text-xs font-semibold transition-all disabled:opacity-50"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Reject
                                  </button>
                                </>
                              )}

                              {isAccepted && (
                                <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Accepted
                                </span>
                              )}

                              {isRejected && (
                                <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Rejected
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Auto Repair Confirmation Modal */}
      {showAutoConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-navy-800 border border-navy-700 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Sparkles className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Execute Autonomous Repair?</h3>
              <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                The AI engine will automatically impute missing values, reconcile inconsistent
                categories, and prune exact duplicates with confidence &gt; 85%.
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                All changes are recorded in the audit trail and can be reviewed or exported anytime.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowAutoConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-xs font-semibold text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAutoRepair}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
              >
                Proceed with Auto Repair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
