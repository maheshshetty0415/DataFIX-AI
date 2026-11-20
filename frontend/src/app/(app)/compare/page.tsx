'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  GitCompare,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Layers,
  Sparkles,
  ExternalLink,
  Table,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import {
  getDatasets,
  getComparison,
  getDatasetPreview,
  Dataset,
  ComparisonData,
  DatasetPreview,
  ModifiedRecord,
} from '@/lib/api';
import DatasetDropdown from '@/components/DatasetDropdown';

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get('dataset');
  const viewParam = searchParams.get('view') as 'modified' | 'original' | 'cleaned' | null;
  const pageParam = searchParams.get('page');
  const initialPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    datasetParam || null
  );
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Tab & Viewer state
  const [activeViewMode, setActiveViewMode] = useState<'modified' | 'original' | 'cleaned'>(
    viewParam || 'modified'
  );
  const [modifiedFilter, setModifiedFilter] = useState<'all' | 'modified' | 'added' | 'removed'>('all');

  // Pagination states (15 rows per page)
  const PAGE_SIZE = 15;
  const [pageModified, setPageModified] = useState<number>(initialPage);
  const [pageOriginal, setPageOriginal] = useState<number>(initialPage);
  const [pageCleaned, setPageCleaned] = useState<number>(initialPage);

  // Load datasets list on mount
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
        toast.error('Failed to load dataset catalog.');
      } finally {
        setLoading(false);
      }
    }
    loadDatasets();
  }, []);

  // Sync dataset from URL query param
  useEffect(() => {
    if (datasetParam) {
      setSelectedDatasetId(datasetParam);
    }
  }, [datasetParam]);

  useEffect(() => {
    if (viewParam) {
      setActiveViewMode(viewParam);
    }
  }, [viewParam]);

  // Load comparison data whenever selectedDatasetId changes
  useEffect(() => {
    if (!selectedDatasetId) return;

    const currentId = selectedDatasetId;
    async function fetchComparisonData() {
      setLoading(true);
      try {
        const data = await getComparison(currentId);
        setComparison(data);
        // Reset pagination on dataset change
        setPageModified(initialPage);
        setPageOriginal(initialPage);
        setPageCleaned(initialPage);
      } catch (err: any) {
        console.error('Failed to load comparison data:', err);
        toast.error('Failed to load comparison data for this dataset.');
        setComparison(null);
      } finally {
        setLoading(false);
      }
    }

    fetchComparisonData();
  }, [selectedDatasetId]);

  // Handle dataset deletion event from dropdown
  const handleDatasetDeleted = (deletedId: string) => {
    const remaining = datasets.filter((d) => String(d.id) !== String(deletedId));
    setDatasets(remaining);
    if (String(selectedDatasetId) === String(deletedId)) {
      if (remaining.length > 0) {
        setSelectedDatasetId(remaining[0].id);
        router.push(`/compare?dataset=${remaining[0].id}`);
      } else {
        setSelectedDatasetId(null);
        setComparison(null);
        router.push('/compare');
      }
    }
  };

  // 1. Prepare Standard 5-Category Grouped Bar Chart Data
  const chartData = useMemo(() => {
    const standardCategories = [
      'Missing Values',
      'Duplicates',
      'Invalid Formats',
      'Inconsistencies',
      'Anomalies',
    ];

    return standardCategories.map((cat) => {
      const match = comparison?.category_comparison?.find((c) => c.category === cat);
      if (match) {
        return {
          category: cat,
          'Before Repair': match.before ?? match['Before Repair'] ?? 0,
          'After Repair': match.after ?? match['After Repair'] ?? 0,
        };
      }
      return {
        category: cat,
        'Before Repair': comparison?.issues_by_category_before?.[cat] ?? 0,
        'After Repair': comparison?.issues_by_category_after?.[cat] ?? 0,
      };
    });
  }, [comparison]);

  const hasIssuesInChart = useMemo(() => {
    return chartData.some((d) => d['Before Repair'] > 0 || d['After Repair'] > 0);
  }, [chartData]);

  // 2. Metrics & Quality Scores with high precision formatting
  const scoreBefore = comparison?.quality_score_before ?? 100;
  const scoreAfter = comparison?.quality_score_after ?? scoreBefore;
  const scoreDiff = Number((scoreAfter - scoreBefore).toFixed(2));
  const formattedScoreDiff = scoreDiff > 0 ? `+${scoreDiff.toFixed(2)}%` : `${scoreDiff.toFixed(2)}%`;

  const missingBefore = comparison?.issues_by_category_before?.['Missing Values'] ?? 0;
  const missingAfter = comparison?.issues_by_category_after?.['Missing Values'] ?? 0;

  const duplicatesBefore = comparison?.issues_by_category_before?.['Duplicates'] ?? 0;
  const duplicatesAfter = comparison?.issues_by_category_after?.['Duplicates'] ?? 0;

  const rowsRemoved = Math.max(0, (comparison?.original_rows || 0) - (comparison?.cleaned_rows || 0));

  // 3. Filtered Modified Records for Inspection Table
  const allRecords = comparison?.modified_records || [];
  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      if (modifiedFilter === 'modified') {
        return !rec.is_deletion && !rec.is_addition;
      }
      if (modifiedFilter === 'added') {
        return rec.is_addition || rec.change_type === 'Missing Imputation';
      }
      if (modifiedFilter === 'removed') {
        return rec.is_deletion || rec.change_type === 'Duplicate Removal';
      }
      return true;
    });
  }, [allRecords, modifiedFilter]);

  const countModified = allRecords.filter((r) => !r.is_deletion && !r.is_addition).length;
  const countAdded = allRecords.filter((r) => r.is_addition || r.change_type === 'Missing Imputation').length;
  const countRemoved = allRecords.filter((r) => r.is_deletion || r.change_type === 'Duplicate Removal').length;

  const totalModPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedModifiedRecords = useMemo(() => {
    const start = (pageModified - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, pageModified]);

  // 4. Original & Cleaned Dataset Tabular Previews with cell highlighting
  const origPreview = comparison?.original_preview || [];
  const origColumns = useMemo(() => {
    if (comparison?.original_columns && comparison.original_columns.length > 0) {
      return comparison.original_columns;
    }
    if (origPreview.length > 0) {
      return Object.keys(origPreview[0]).filter((k) => !k.startsWith('_'));
    }
    return [];
  }, [comparison, origPreview]);

  const totalOrigPages = Math.max(1, Math.ceil(origPreview.length / PAGE_SIZE));
  const pagedOrigRows = useMemo(() => {
    const start = (pageOriginal - 1) * PAGE_SIZE;
    return origPreview.slice(start, start + PAGE_SIZE);
  }, [origPreview, pageOriginal]);

  const cleanedPreview = comparison?.cleaned_preview || [];
  const cleanedColumns = useMemo(() => {
    if (comparison?.cleaned_columns && comparison.cleaned_columns.length > 0) {
      return comparison.cleaned_columns;
    }
    if (cleanedPreview.length > 0) {
      return Object.keys(cleanedPreview[0]).filter((k) => !k.startsWith('_'));
    }
    return [];
  }, [comparison, cleanedPreview]);

  const totalCleanedPages = Math.max(1, Math.ceil(cleanedPreview.length / PAGE_SIZE));
  const pagedCleanedRows = useMemo(() => {
    const start = (pageCleaned - 1) * PAGE_SIZE;
    return cleanedPreview.slice(start, start + PAGE_SIZE);
  }, [cleanedPreview, pageCleaned]);

  // 5. Trust Quotient Status derived from actual validation results
  const trustStatus = useMemo(() => {
    if (comparison?.trust_status) {
      return comparison.trust_status;
    }
    if (comparison?.validation_status) {
      return comparison.validation_status;
    }
    if (!comparison?.validation_passed) {
      return 'Pending Remediation';
    }
    if ((comparison?.remaining_errors ?? 0) > 0) {
      return 'Partially Repaired — Manual Review Required';
    }
    return 'Ready for Production Ingestion';
  }, [comparison]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header & Dataset Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <GitCompare className="w-7 h-7 text-blue-500" />
            Before & After Comparison
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Quantify data quality lift, track modified rows, and inspect differential distribution curves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {datasets.length > 0 && (
            <DatasetDropdown
              datasets={datasets}
              selectedDatasetId={selectedDatasetId}
              onSelect={(val) => {
                setSelectedDatasetId(val);
                router.push(`/compare?dataset=${val}`);
              }}
              onDatasetDeleted={handleDatasetDeleted}
            />
          )}

          {selectedDatasetId && (
            <Link
              href={`/reports?dataset=${selectedDatasetId}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-0.5"
            >
              Export Results
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {loading && !comparison && (
        <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-navy-800 border border-navy-700">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-3" />
          <p className="text-sm text-gray-300 font-medium">Computing dataset comparison metrics...</p>
        </div>
      )}

      {!loading && !selectedDatasetId && (
        <div className="p-12 text-center rounded-xl bg-navy-800 border border-navy-700">
          <Database className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Dataset Selected</h3>
          <p className="text-xs text-gray-400 mt-1">
            Select a dataset from the dropdown above to inspect before-and-after quality comparison.
          </p>
        </div>
      )}

      {selectedDatasetId && comparison && (
        <>
          {/* Top Metric Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Rows Count Before vs After */}
            <div className="p-5 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Dataset Row Count
              </span>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-xl font-bold text-gray-400 line-through">
                  {(comparison.original_rows || 0).toLocaleString()}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-2xl font-extrabold text-white">
                  {(comparison.cleaned_rows || comparison.original_rows || 0).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {rowsRemoved > 0
                  ? `${rowsRemoved} duplicate row${rowsRemoved > 1 ? 's' : ''} removed`
                  : 'Row count preserved'}
              </p>
            </div>

            {/* Missing Values Before vs After */}
            <div className="p-5 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Missing Values
              </span>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-xl font-bold text-red-400 line-through">
                  {missingBefore}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-2xl font-extrabold text-emerald-400">
                  {missingAfter}
                </span>
              </div>
              <p className="text-[11px] text-emerald-400/90 mt-1">
                {missingAfter === 0 ? '100% Imputed accurately' : `${missingAfter} remaining unresolved`}
              </p>
            </div>

            {/* Duplicates Before vs After */}
            <div className="p-5 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Duplicate Rows
              </span>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-xl font-bold text-purple-400 line-through">
                  {duplicatesBefore}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-2xl font-extrabold text-emerald-400">
                  {duplicatesAfter}
                </span>
              </div>
              <p className="text-[11px] text-emerald-400/90 mt-1">
                {duplicatesAfter === 0 ? 'Redundant records pruned' : `${duplicatesAfter} remaining`}
              </p>
            </div>

            {/* Quality Score Lift */}
            <div className="p-5 rounded-xl bg-navy-800 border border-navy-700 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Quality Score Lift
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {formattedScoreDiff}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-xl font-bold text-gray-400">{scoreBefore.toFixed(1)}%</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                  {scoreAfter.toFixed(1)}%
                </span>
              </div>
              <p className="text-[11px] text-purple-300 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> High-confidence reliability
              </p>
            </div>
          </div>

          {/* Comparison Charts & Trust Quotient Gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Category Comparison Grouped Bar Chart */}
            <div className="lg:col-span-8 p-6 rounded-xl bg-navy-800 border border-navy-700 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Issues Before vs After Repair
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Reduction across critical defect classifications
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block"></span> Before
                  </span>
                  <span className="inline-flex items-center gap-1 text-gray-400 ml-2">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span> After
                  </span>
                </div>
              </div>

              {hasIssuesInChart ? (
                <div className="h-[320px] w-full" style={{ minHeight: '320px' }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 15, right: 25, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2652" vertical={false} />
                      <XAxis
                        dataKey="category"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                        contentStyle={{
                          backgroundColor: '#141937',
                          borderColor: '#1e2652',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        dataKey="Before Repair"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="After Repair"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[320px] w-full flex flex-col items-center justify-center p-6 text-center rounded-lg bg-navy-900/50 border border-navy-700/50">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
                  <h4 className="text-sm font-bold text-white">No Issues Detected</h4>
                  <p className="text-xs text-gray-400 max-w-sm mt-1">
                    All 5 categories (Missing Values, Duplicates, Invalid Formats, Inconsistencies, Anomalies) report zero defects.
                  </p>
                </div>
              )}
            </div>

            {/* Trust Quotient Card */}
            <div className="lg:col-span-4 p-6 rounded-xl bg-navy-800 border border-navy-700 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Trust Quotient
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Statistical confidence rating</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      trustStatus === 'Ready for Production Ingestion'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : trustStatus === 'Partially Repaired — Manual Review Required'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                    }`}
                  >
                    {comparison.validation_passed ? 'VALIDATED' : 'INSPECTION'}
                  </span>
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-gray-400">Before Repair</span>
                      <span className="text-red-400 font-mono">{scoreBefore.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-navy-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, scoreBefore))}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-emerald-400 font-bold">After AI Remediation</span>
                      <span className="text-emerald-400 font-bold font-mono">{scoreAfter.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-navy-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, scoreAfter))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Trust Metrics */}
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-navy-900 border border-navy-700/60">
                    <span className="text-gray-400 text-[10px] block uppercase font-semibold">Remaining Issues</span>
                    <span className={`text-sm font-bold font-mono ${comparison.remaining_errors > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {comparison.remaining_errors}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-navy-900 border border-navy-700/60">
                    <span className="text-gray-400 text-[10px] block uppercase font-semibold">Pending Reviews</span>
                    <span className="text-sm font-bold font-mono text-blue-400">
                      {comparison.pending_reviews_count ?? comparison.remaining_errors}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Status Box */}
              <div
                className={`p-3.5 rounded-lg border mt-5 ${
                  trustStatus === 'Ready for Production Ingestion'
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : trustStatus === 'Partially Repaired — Manual Review Required'
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-blue-950/20 border-blue-500/30'
                }`}
              >
                <div
                  className={`flex items-center gap-2 text-xs font-bold ${
                    trustStatus === 'Ready for Production Ingestion'
                      ? 'text-emerald-400'
                      : trustStatus === 'Partially Repaired — Manual Review Required'
                      ? 'text-amber-400'
                      : 'text-blue-400'
                  }`}
                >
                  {trustStatus === 'Ready for Production Ingestion' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : trustStatus === 'Partially Repaired — Manual Review Required' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  )}
                  {trustStatus}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {trustStatus === 'Ready for Production Ingestion'
                    ? 'All identified format inconsistencies and anomalous rows have been reconciled and validated.'
                    : trustStatus === 'Partially Repaired — Manual Review Required'
                    ? `${comparison.remaining_errors} issue(s) require human verification before production ingestion.`
                    : 'Dataset has pending repairs or requires formal validation before export.'}
                </p>
              </div>
            </div>
          </div>

          {/* Inspection Table & View Mode Switcher */}
          <div className="rounded-xl bg-navy-800 border border-navy-700 overflow-hidden shadow-xl">
            {/* View Mode Toolbar */}
            <div className="p-5 border-b border-navy-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Table className="w-4 h-4 text-blue-400" />
                  Inspection Table
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Review specific row alterations or inspect raw original vs cleaned dataset tables
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveViewMode('modified')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeViewMode === 'modified'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-navy-700 text-gray-300 hover:text-white hover:bg-navy-650'
                  }`}
                >
                  Modified Changes ({comparison.modified_records?.length || 0})
                </button>
                <button
                  onClick={() => setActiveViewMode('original')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeViewMode === 'original'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-navy-700 text-gray-300 hover:text-white hover:bg-navy-650'
                  }`}
                >
                  View Original Dataset
                </button>
                <button
                  onClick={() => setActiveViewMode('cleaned')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeViewMode === 'cleaned'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'bg-navy-700 text-gray-300 hover:text-white hover:bg-navy-650'
                  }`}
                >
                  View Cleaned Dataset
                </button>
              </div>
            </div>

            {/* Sub-Tabs for Modified Changes */}
            {activeViewMode === 'modified' && (
              <div className="px-5 py-3 bg-navy-900/60 border-b border-navy-700 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400 font-semibold mr-2 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filter:
                </span>
                <button
                  onClick={() => {
                    setModifiedFilter('all');
                    setPageModified(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    modifiedFilter === 'all'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All Changes ({allRecords.length})
                </button>
                <button
                  onClick={() => {
                    setModifiedFilter('modified');
                    setPageModified(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    modifiedFilter === 'modified'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Modified Changes ({countModified})
                </button>
                <button
                  onClick={() => {
                    setModifiedFilter('added');
                    setPageModified(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    modifiedFilter === 'added'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Added Values ({countAdded})
                </button>
                <button
                  onClick={() => {
                    setModifiedFilter('removed');
                    setPageModified(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    modifiedFilter === 'removed'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Removed Rows ({countRemoved})
                </button>
              </div>
            )}

            {/* Table Content */}
            <div className="overflow-x-auto">
              {/* 1. MODIFIED CHANGES TABLE */}
              {activeViewMode === 'modified' && (
                <>
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-navy-900/90 text-[11px] font-bold uppercase text-gray-400 border-b border-navy-700">
                      <tr>
                        <th className="py-3 px-4">Row</th>
                        <th className="py-3 px-4">Column Name</th>
                        <th className="py-3 px-4">Original Value</th>
                        <th className="py-3 px-4">New Value (Repaired)</th>
                        <th className="py-3 px-4">Change Type</th>
                        <th className="py-3 px-4">Repair Method</th>
                        <th className="py-3 px-4">Confidence</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700/50">
                      {pagedModifiedRecords.length > 0 ? (
                        pagedModifiedRecords.map((rec, idx) => {
                          const isDeletion = rec.is_deletion || rec.change_type === 'Duplicate Removal';
                          const isAddition = rec.is_addition || rec.change_type === 'Missing Imputation';

                          return (
                            <tr
                              key={rec.id || idx}
                              className={`hover:bg-navy-750/50 transition-colors ${
                                isDeletion ? 'bg-red-950/10' : ''
                              }`}
                            >
                              <td className="py-3 px-4 font-mono font-semibold text-gray-300">
                                #{rec.row_number ?? rec.row_index}
                                {isDeletion && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                    Removed
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-bold text-white font-mono">
                                {rec.column_name}
                              </td>
                              <td className="py-3 px-4 font-mono text-red-400">
                                <span className="line-through bg-red-500/10 px-1.5 py-0.5 rounded">
                                  {rec.original_value === null || rec.original_value === undefined
                                    ? '<null>'
                                    : String(rec.original_value)}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                                <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  {rec.new_value === null || rec.new_value === undefined
                                    ? '<null>'
                                    : String(rec.new_value)}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    isDeletion
                                      ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                      : isAddition
                                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                      : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                  }`}
                                >
                                  {rec.change_type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-300 max-w-xs truncate" title={rec.repair_method}>
                                {rec.repair_method || 'Applied correction'}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`font-mono text-xs font-bold ${
                                    (rec.confidence ?? 100) >= 90
                                      ? 'text-emerald-400'
                                      : (rec.confidence ?? 100) >= 75
                                      ? 'text-blue-400'
                                      : 'text-amber-400'
                                  }`}
                                >
                                  {rec.confidence ?? 100}%
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  {rec.status || 'Auto-repaired'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-gray-400">
                            No modification records match the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Pagination for Modified Records */}
                  {filteredRecords.length > 0 && (
                    <div className="flex items-center justify-between p-3 border-t border-navy-700 bg-navy-900/60 text-xs text-gray-400">
                      <span>
                        Showing {(pageModified - 1) * PAGE_SIZE + 1} -{' '}
                        {Math.min(pageModified * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length}{' '}
                        modifications
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={pageModified <= 1}
                          onClick={() => setPageModified((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Previous
                        </button>
                        <span className="font-semibold text-gray-300 px-2">
                          Page {pageModified} of {totalModPages}
                        </span>
                        <button
                          disabled={pageModified >= totalModPages}
                          onClick={() => setPageModified((p) => Math.min(totalModPages, p + 1))}
                          className="px-2.5 py-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 2. ORIGINAL DATASET TABULAR VIEW */}
              {activeViewMode === 'original' && (
                <>
                  <div className="p-3 bg-navy-900/60 border-b border-navy-700 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-900 border border-red-500 inline-block"></span>
                      Removed duplicate row
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500 inline-block ml-3"></span>
                      Cell altered in cleaned version
                    </span>
                    <span className="font-mono text-gray-400">
                      Total: {origPreview.length} rows previewed
                    </span>
                  </div>

                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-navy-900/90 text-[11px] font-bold uppercase text-gray-400 border-b border-navy-700">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        {origColumns.map((c) => (
                          <th key={c} className="py-2.5 px-3 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700/50">
                      {pagedOrigRows.length > 0 ? (
                        pagedOrigRows.map((r, i) => {
                          const actualRowIdx = (pageOriginal - 1) * PAGE_SIZE + i;
                          const isDeleted = Boolean(r._is_deleted);
                          const modCols: string[] = r._modified_columns || [];

                          return (
                            <tr
                              key={actualRowIdx}
                              className={`transition-colors ${
                                isDeleted
                                  ? 'bg-red-950/30 border-l-2 border-red-500 hover:bg-red-950/40'
                                  : 'hover:bg-navy-750/50'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono text-gray-400 whitespace-nowrap">
                                #{actualRowIdx}
                                {isDeleted && (
                                  <span
                                    className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40"
                                    title={r._deletion_info || 'Duplicate row removed'}
                                  >
                                    Removed (Duplicate)
                                  </span>
                                )}
                              </td>
                              {origColumns.map((c) => {
                                const isCellModified = modCols.includes(c);
                                return (
                                  <td
                                    key={c}
                                    className={`py-2 px-3 font-mono whitespace-nowrap ${
                                      isDeleted ? 'line-through text-red-300/70' : ''
                                    }`}
                                  >
                                    {isCellModified ? (
                                      <span
                                        className="bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 rounded px-1.5 py-0.5"
                                        title={`Original value: "${String(r[c] ?? '')}" (Altered in cleaned)`}
                                      >
                                        {r[c] === null || r[c] === undefined ? '<null>' : String(r[c])}
                                      </span>
                                    ) : (
                                      <span>
                                        {r[c] === null || r[c] === undefined ? '<null>' : String(r[c])}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={origColumns.length + 1} className="py-12 text-center text-gray-400">
                            No original dataset rows available for preview.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Pagination for Original Preview */}
                  {origPreview.length > 0 && (
                    <div className="flex items-center justify-between p-3 border-t border-navy-700 bg-navy-900/60 text-xs text-gray-400">
                      <span>
                        Showing {(pageOriginal - 1) * PAGE_SIZE + 1} -{' '}
                        {Math.min(pageOriginal * PAGE_SIZE, origPreview.length)} of {origPreview.length} rows
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={pageOriginal <= 1}
                          onClick={() => setPageOriginal((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Previous
                        </button>
                        <span className="font-semibold text-gray-300 px-2">
                          Page {pageOriginal} of {totalOrigPages}
                        </span>
                        <button
                          disabled={pageOriginal >= totalOrigPages}
                          onClick={() => setPageOriginal((p) => Math.min(totalOrigPages, p + 1))}
                          className="px-2.5 py-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 3. CLEANED DATASET TABULAR VIEW */}
              {activeViewMode === 'cleaned' && (
                <>
                  <div className="p-3 bg-navy-900/60 border-b border-navy-700 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500 inline-block"></span>
                      Repaired & validated cell
                    </span>
                    <span className="font-mono text-gray-400">
                      Total: {cleanedPreview.length} rows previewed (Cleaned)
                    </span>
                  </div>

                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-navy-900/90 text-[11px] font-bold uppercase text-gray-400 border-b border-navy-700">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        {cleanedColumns.map((c) => (
                          <th key={c} className="py-2.5 px-3 whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700/50">
                      {pagedCleanedRows.length > 0 ? (
                        pagedCleanedRows.map((r, i) => {
                          const actualRowIdx = (pageCleaned - 1) * PAGE_SIZE + i;
                          const modCols: string[] = r._modified_columns || [];

                          return (
                            <tr key={actualRowIdx} className="hover:bg-navy-750/50 transition-colors">
                              <td className="py-2 px-3 font-mono text-gray-400 whitespace-nowrap">
                                #{actualRowIdx}
                              </td>
                              {cleanedColumns.map((c) => {
                                const isCellModified = modCols.includes(c);
                                return (
                                  <td key={c} className="py-2 px-3 font-mono whitespace-nowrap">
                                    {isCellModified ? (
                                      <span
                                        className="bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 rounded px-1.5 py-0.5"
                                        title={`Cleaned / Repaired value: "${String(r[c] ?? '')}"`}
                                      >
                                        {r[c] === null || r[c] === undefined ? '<null>' : String(r[c])}
                                      </span>
                                    ) : (
                                      <span>
                                        {r[c] === null || r[c] === undefined ? '<null>' : String(r[c])}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={cleanedColumns.length + 1} className="py-12 text-center text-gray-400">
                            No cleaned dataset rows available for preview.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Pagination for Cleaned Preview */}
                  {cleanedPreview.length > 0 && (
                    <div className="flex items-center justify-between p-3 border-t border-navy-700 bg-navy-900/60 text-xs text-gray-400">
                      <span>
                        Showing {(pageCleaned - 1) * PAGE_SIZE + 1} -{' '}
                        {Math.min(pageCleaned * PAGE_SIZE, cleanedPreview.length)} of {cleanedPreview.length} rows
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={pageCleaned <= 1}
                          onClick={() => setPageCleaned((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Previous
                        </button>
                        <span className="font-semibold text-gray-300 px-2">
                          Page {pageCleaned} of {totalCleanedPages}
                        </span>
                        <button
                          disabled={pageCleaned >= totalCleanedPages}
                          onClick={() => setPageCleaned((p) => Math.min(totalCleanedPages, p + 1))}
                          className="px-2.5 py-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
