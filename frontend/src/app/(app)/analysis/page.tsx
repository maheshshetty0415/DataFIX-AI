'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Filter,
  AlertTriangle,
  Copy,
  FileQuestion,
  HelpCircle,
  Activity,
  Wrench,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  Layers,
  ArrowRight,
  Database,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDatasets, getIssues, Dataset, Issue } from '@/lib/api';
import DatasetDropdown from '@/components/DatasetDropdown';

const TABS = [
  { id: 'all', label: 'All Issues' },
  { id: 'missing_value', label: 'Missing Values' },
  { id: 'duplicate', label: 'Duplicates' },
  { id: 'invalid_format', label: 'Invalid Formats' },
  { id: 'inconsistency', label: 'Inconsistencies' },
  { id: 'anomaly', label: 'Anomalies' },
];

export default function AnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get('dataset');

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    datasetParam || null
  );
  const [activeTab, setActiveTab] = useState<string>('all');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

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

  // Sync selectedDatasetId if param changes
  useEffect(() => {
    if (datasetParam) {
      setSelectedDatasetId(datasetParam);
    }
  }, [datasetParam]);

  // Load issues when selected dataset or active tab changes
  useEffect(() => {
    if (!selectedDatasetId) return;

    const currentId = selectedDatasetId;
    async function loadIssuesData() {
      setLoading(true);
      try {
        const data = await getIssues(currentId, activeTab);
        setIssues(data || []);
      } catch (err: any) {
        console.error('Failed to load issues:', err);
        setIssues([]);
        toast.error('Unable to retrieve issues for this dataset.');
      } finally {
        setLoading(false);
      }
    }

    loadIssuesData();
  }, [selectedDatasetId, activeTab]);

  // Compute breakdown metrics
  const missingCount = issues.filter(
    (i) => i.issue_type?.toLowerCase().includes('missing') || i.issue_type === 'null_value'
  ).length;
  const duplicateCount = issues.filter((i) =>
    i.issue_type?.toLowerCase().includes('duplicate')
  ).length;
  const formatCount = issues.filter(
    (i) =>
      i.issue_type?.toLowerCase().includes('format') ||
      i.issue_type?.toLowerCase().includes('syntax')
  ).length;
  const inconsistencyCount = issues.filter(
    (i) =>
      i.issue_type?.toLowerCase().includes('inconsisten') ||
      i.issue_type?.toLowerCase().includes('conflict')
  ).length;
  const anomalyCount = issues.filter(
    (i) =>
      i.issue_type?.toLowerCase().includes('anomaly') ||
      i.issue_type?.toLowerCase().includes('outlier')
  ).length;

  const currentDataset = datasets.find((d) => d.id === selectedDatasetId);

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      default:
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
    }
  };

  const handleDatasetDeleted = (deletedId: string) => {
    const remaining = datasets.filter((d) => String(d.id) !== String(deletedId));
    setDatasets(remaining);
    if (String(selectedDatasetId) === String(deletedId)) {
      if (remaining.length > 0) {
        setSelectedDatasetId(remaining[0].id);
        router.push(`/analysis?dataset=${remaining[0].id}`);
      } else {
        setSelectedDatasetId(null);
        setIssues([]);
        router.push('/analysis');
      }
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Dataset Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Data Quality Diagnostics
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Deep statistical profiling, anomaly detection, and schema verification results.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {datasets.length > 0 && (
            <DatasetDropdown
              datasets={datasets}
              selectedDatasetId={selectedDatasetId}
              onSelect={(val) => {
                setSelectedDatasetId(val);
                router.push(`/analysis?dataset=${val}`);
              }}
              onDatasetDeleted={handleDatasetDeleted}
            />
          )}

          {selectedDatasetId && (
            <Link
              href={`/repair?dataset=${selectedDatasetId}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-0.5"
            >
              <Wrench className="w-3.5 h-3.5" />
              Go to Repair Centre
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          )}
        </div>
      </div>

      {/* Empty State when no datasets exist */}
      {!selectedDatasetId && !loading && (
        <div className="p-12 text-center rounded-2xl bg-navy-800/80 border border-navy-700/80">
          <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No Dataset Selected</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Please upload a dataset or choose one from the dashboard to view diagnostic metrics and
            issues.
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
          {/* Quality Score & Formula Explanation Banner */}
          {(() => {
            const activeDataset = datasets.find((d) => d.id === selectedDatasetId);
            const initialScore =
              activeDataset?.quality_score_before !== null && activeDataset?.quality_score_before !== undefined
                ? Math.round(activeDataset.quality_score_before)
                : Math.round(activeDataset?.quality_score || 100);
            const currentScore =
              activeDataset?.quality_score_after !== null && activeDataset?.quality_score_after !== undefined
                ? Math.round(activeDataset.quality_score_after)
                : Math.round(activeDataset?.quality_score || 100);
            const scoreDelta = Math.max(0, currentScore - initialScore);
            const remainingCount = issues.filter(
              (i) => i.status === 'detected' || i.status === 'pending'
            ).length;

            return (
              <div className="p-5 rounded-2xl bg-navy-800/90 border border-navy-700/80 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-sm">
                      QS
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Dataset Health Metric
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          Documented Formula
                        </span>
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        Score = max(0, 100 × (1 - Σ(Severity_Weights) / Total_Cells))
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <div className="px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700/80">
                      <span className="text-gray-400">Initial Score:</span>{' '}
                      <span className="font-bold text-white">{initialScore}%</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700/80">
                      <span className="text-gray-400">Current Score:</span>{' '}
                      <span className="font-bold text-emerald-400">{currentScore}%</span>
                    </div>
                    {scoreDelta > 0 && (
                      <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
                        +{scoreDelta}% Improvement
                      </div>
                    )}
                    <div className="px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700/80">
                      <span className="text-gray-400">Remaining Issues:</span>{' '}
                      <span className="font-bold text-amber-400">{remainingCount}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-gray-400">
                  <span>
                    Penalty Weights: <strong className="text-red-400">Critical (3.0)</strong> •{' '}
                    <strong className="text-orange-400">High (2.0)</strong> •{' '}
                    <strong className="text-yellow-400">Medium (1.0)</strong> •{' '}
                    <strong className="text-blue-400">Low (0.5)</strong>
                  </span>
                  <span className="text-gray-500">
                    Transparent formula guarantees objective, reproducible quality quantification.
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Issue Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Missing Values */}
            <div
              onClick={() => setActiveTab('missing_value')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'missing_value'
                  ? 'bg-navy-750 border-blue-500 shadow-md shadow-blue-500/10'
                  : 'bg-navy-800 border-navy-700/80 hover:border-navy-600'
              }`}
            >
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Missing</span>
                <FileQuestion className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {missingCount || (activeTab === 'all' ? 0 : '-')}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Null / blank cells</p>
            </div>

            {/* Duplicates */}
            <div
              onClick={() => setActiveTab('duplicate')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'duplicate'
                  ? 'bg-navy-750 border-purple-500 shadow-md shadow-purple-500/10'
                  : 'bg-navy-800 border-navy-700/80 hover:border-navy-600'
              }`}
            >
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Duplicates</span>
                <Copy className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {duplicateCount || (activeTab === 'all' ? 0 : '-')}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Repeated rows</p>
            </div>

            {/* Invalid Formats */}
            <div
              onClick={() => setActiveTab('invalid_format')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'invalid_format'
                  ? 'bg-navy-750 border-red-500 shadow-md shadow-red-500/10'
                  : 'bg-navy-800 border-navy-700/80 hover:border-navy-600'
              }`}
            >
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Invalid Formats</span>
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {formatCount || (activeTab === 'all' ? 0 : '-')}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Date, phone, email errors</p>
            </div>

            {/* Inconsistencies */}
            <div
              onClick={() => setActiveTab('inconsistency')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'inconsistency'
                  ? 'bg-navy-750 border-cyan-500 shadow-md shadow-cyan-500/10'
                  : 'bg-navy-800 border-navy-700/80 hover:border-navy-600'
              }`}
            >
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Inconsistencies</span>
                <HelpCircle className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {inconsistencyCount || (activeTab === 'all' ? 0 : '-')}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Casing, category typos</p>
            </div>

            {/* Anomalies */}
            <div
              onClick={() => setActiveTab('anomaly')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                activeTab === 'anomaly'
                  ? 'bg-navy-750 border-emerald-500 shadow-md shadow-emerald-500/10'
                  : 'bg-navy-800 border-navy-700/80 hover:border-navy-600'
              }`}
            >
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-semibold uppercase">Anomalies</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                {anomalyCount || (activeTab === 'all' ? 0 : '-')}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Statistical outliers</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-navy-700/80 pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-navy-800 text-gray-400 hover:text-white hover:bg-navy-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Issues Table */}
          <div className="rounded-xl bg-navy-800 border border-navy-700/80 overflow-hidden">
            <div className="p-4 border-b border-navy-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Detected Diagnostic Anomalies ({issues.length})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Click any row to reveal algorithmic explanations and suggested actions
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {issues.filter((i) => i.status === 'accepted').length} resolved
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" />
                  <p className="text-xs">Scanning dataset records...</p>
                </div>
              ) : issues.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">No Issues Detected</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    No matching quality issues found for the selected filter category.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-navy-900/80 text-[11px] font-bold uppercase text-gray-400 border-b border-navy-700">
                    <tr>
                      <th className="py-3 px-4">Column</th>
                      <th className="py-3 px-4">Row</th>
                      <th className="py-3 px-4">Original Value</th>
                      <th className="py-3 px-4">Issue Type</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Suggested Action</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-3 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {issues.map((issue) => {
                      const isExpanded = expandedIssueId === issue.id;

                      return (
                        <React.Fragment key={issue.id}>
                          <tr
                            onClick={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                            className="hover:bg-navy-750/60 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-4 font-bold text-white font-mono">
                              {issue.column_name || 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono text-gray-400">
                              #{issue.row_index ?? 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono text-red-400">
                              {issue.original_value === null || issue.original_value === undefined
                                ? '<null>'
                                : String(issue.original_value)}
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-200">
                              <span className="capitalize">
                                {issue.issue_type?.replace(/_/g, ' ') || 'Anomaly'}
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-xs truncate text-gray-400" title={issue.description}>
                              {issue.description || 'Discrepancy detected in values'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getSeverityBadge(
                                  issue.severity
                                )}`}
                              >
                                {issue.severity || 'Medium'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-emerald-400 font-medium">
                              {issue.suggested_action || 'Impute value'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                  issue.status === 'accepted' || issue.status === 'auto_repaired'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : issue.status === 'rejected'
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-navy-700 text-gray-300'
                                }`}
                              >
                                {issue.status || 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-gray-400">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 mx-auto text-blue-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 mx-auto" />
                              )}
                            </td>
                          </tr>

                          {/* Expanded Detail Panel */}
                          {isExpanded && (
                            <tr className="bg-navy-900/90 border-b border-navy-700">
                              <td colSpan={9} className="p-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="p-3 rounded-lg bg-navy-800/80 border border-navy-700">
                                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                                      Diagnosis Explanation & Transparency
                                    </span>
                                    {issue.explanation && issue.explanation.includes('|') ? (
                                      <div className="mt-2 space-y-1.5 text-xs">
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
                                      <p className="text-xs text-gray-200 mt-1 leading-relaxed">
                                        {issue.explanation ||
                                          issue.description ||
                                          'Value deviates from inferred column distribution and schema specification.'}
                                      </p>
                                    )}
                                  </div>

                                  <div className="p-3 rounded-lg bg-navy-800/80 border border-navy-700">
                                    <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                                      Proposed Repair Value
                                    </span>
                                    <div className="mt-1 font-mono text-xs text-emerald-400 font-semibold bg-navy-950 p-2 rounded border border-emerald-500/20">
                                      {issue.suggested_value !== undefined && issue.suggested_value !== null
                                        ? String(issue.suggested_value)
                                        : 'Autonomous standardisation'}
                                    </div>
                                    <div className="mt-2 text-[10px] text-gray-400 flex items-center justify-between">
                                      <span>Model Confidence:</span>
                                      <span className="text-purple-400 font-bold">
                                        {Math.round((issue.confidence || 0.85) * 100)}%
                                      </span>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-navy-800/80 border border-navy-700 flex flex-col justify-between">
                                    <div>
                                      <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                                        Direct Action
                                      </span>
                                      <p className="text-xs text-gray-300 mt-1">
                                        Review and confirm this fix in the AI Repair Centre.
                                      </p>
                                    </div>
                                    <Link
                                      href={`/repair?dataset=${selectedDatasetId}`}
                                      className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                                    >
                                      <Wrench className="w-3.5 h-3.5" />
                                      Resolve in Repair Centre
                                    </Link>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
