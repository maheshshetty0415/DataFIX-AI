'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Database,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Upload,
  Search,
  Trash2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Check,
  XCircle,
  Clock,
  Layers,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { getStats, getDatasets, deleteDataset, Dataset, StatsResponse } from '@/lib/api';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState<{ id: string | number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [statsData, datasetsData] = await Promise.allSettled([
        getStats(),
        getDatasets(),
      ]);

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      } else {
        setStats({
          total_datasets: 0,
          total_errors_detected: 0,
          errors_repaired: 0,
          average_quality_score: 0,
          open_issues: 0,
          accepted_repairs: 0,
          rejected_suggestions: 0,
          pending_reviews: 0,
          successfully_validated_repairs: 0,
          recent_quality_trend: [],
          error_distribution: [],
        });
      }

      if (datasetsData.status === 'fulfilled') {
        setDatasets(datasetsData.value || []);
      } else {
        setDatasets([]);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      toast.error('Unable to fetch latest dashboard stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirmDelete = async () => {
    if (!datasetToDelete || isDeleting) return;
    setIsDeleting(true);
    const target = datasetToDelete;
    try {
      await deleteDataset(target.id);
      toast.success('Dataset permanently deleted.');
      setDatasetToDelete(null);
      await fetchData();
    } catch (err: any) {
      console.error('Delete error:', err);
      const errMsg = err?.response?.data?.detail || err?.message || 'Failed to delete dataset';
      toast.error(`Error deleting dataset: ${errMsg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Derive charts data with robust number parsing and clean labels
  const rawChartData =
    stats?.recent_quality_trend && stats.recent_quality_trend.length > 0
      ? stats.recent_quality_trend
      : datasets
          .filter((d) => d.quality_score !== undefined && d.quality_score !== null)
          .slice(0, 6)
          .map((d) => ({
            dataset_name: d.name || `Dataset #${d.id}`,
            quality_score: Math.round(d.quality_score || 0),
          }));

  const qualityChartData = rawChartData.map((item) => {
    const rawName = item.dataset_name || 'Dataset';
    const cleanName = rawName.length > 14 ? rawName.slice(0, 12) + '...' : rawName;
    const scoreVal = typeof item.quality_score === 'number' && !isNaN(item.quality_score)
      ? Math.max(0, Math.min(100, Math.round(item.quality_score)))
      : 100;
    return {
      dataset_name: cleanName,
      full_name: rawName,
      quality_score: scoreVal,
    };
  });

  const pieChartData =
    stats?.error_distribution && stats.error_distribution.length > 0
      ? stats.error_distribution.filter((d) => d.count > 0)
      : [
          { category: 'Missing Values', count: 0 },
          { category: 'Duplicates', count: 0 },
          { category: 'Invalid Formats', count: 0 },
          { category: 'Inconsistencies', count: 0 },
          { category: 'Anomalies', count: 0 },
        ];

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Engine Overview
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time telemetry, dataset health profiles, and repair engine throughput.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-gray-300 border border-navy-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            Refresh
          </button>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all transform hover:-translate-y-0.5"
          >
            <Upload className="w-4 h-4" />
            Upload Dataset
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Datasets */}
        <div className="p-5 rounded-xl bg-navy-800 border border-navy-700/80 relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Total Datasets
            </span>
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white">
              {loading ? '-' : stats?.total_datasets ?? datasets.length}
            </span>
            <p className="text-xs text-blue-400/80 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Ingested & Profiling
            </p>
          </div>
        </div>

        {/* Errors Detected */}
        <div className="p-5 rounded-xl bg-navy-800 border border-navy-700/80 relative overflow-hidden group hover:border-red-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Errors Detected
            </span>
            <div className="w-10 h-10 rounded-lg bg-red-600/20 text-red-400 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white">
              {loading ? '-' : (stats?.total_errors_detected ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-red-400/80 mt-1 flex items-center gap-1">
              Flagged across all audits
            </p>
          </div>
        </div>

        {/* Errors Repaired */}
        <div className="p-5 rounded-xl bg-navy-800 border border-navy-700/80 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Errors Repaired
            </span>
            <div className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white">
              {loading ? '-' : (stats?.errors_repaired ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
              Autonomous & confirmed fixes
            </p>
          </div>
        </div>

        {/* Average Quality Score */}
        <div className="p-5 rounded-xl bg-navy-800 border border-navy-700/80 relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Average Quality
            </span>
            <div className="w-10 h-10 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white">
              {loading ? '-' : `${Math.round(stats?.average_quality_score ?? 100)}%`}
            </span>
            <p className="text-xs text-purple-400/80 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Reliability index
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Telemetry Status Bar: Distinguish open, accepted, rejected, pending, validated */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-xl bg-navy-850/80 border border-navy-700/60 text-xs">
        <div className="flex items-center gap-2 text-gray-300">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-gray-400">Open Issues:</span>
          <span className="font-bold font-mono text-amber-300">{stats?.open_issues ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-gray-400">Accepted:</span>
          <span className="font-bold font-mono text-emerald-300">{stats?.accepted_repairs ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-gray-400">Rejected:</span>
          <span className="font-bold font-mono text-red-300">{stats?.rejected_suggestions ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-gray-400">Pending Review:</span>
          <span className="font-bold font-mono text-blue-300">{stats?.pending_reviews ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span className="text-gray-400">Validated Repaired:</span>
          <span className="font-bold font-mono text-purple-300">{stats?.successfully_validated_repairs ?? 0}</span>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar Chart: Quality Scores */}
        <div className="lg:col-span-7 p-6 rounded-xl bg-navy-800 border border-navy-700/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Dataset Quality Scores</h2>
              <p className="text-xs text-gray-400 mt-0.5">Reliability score breakdown across analyzed datasets</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
              Benchmark: &gt;85%
            </span>
          </div>

          <div className="h-64 w-full">
            {qualityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityChartData} margin={{ top: 15, right: 15, left: 0, bottom: 35 }}>
                  <XAxis
                    dataKey="dataset_name"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, 'Quality Score']}
                    labelFormatter={(label: any, payload: any) => {
                      const full = payload?.[0]?.payload?.full_name;
                      return full || label;
                    }}
                    contentStyle={{
                      backgroundColor: '#141937',
                      borderColor: '#1e2652',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="quality_score" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <BarChart3 className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-sm">No dataset quality metrics recorded yet.</p>
                <Link href="/upload" className="text-xs text-blue-400 hover:underline mt-1">
                  Upload a dataset to generate profile
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart: Error Distribution */}
        <div className="lg:col-span-5 p-6 rounded-xl bg-navy-800 border border-navy-700/80 flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-base font-bold text-white">Error Distribution</h2>
            <p className="text-xs text-gray-400 mt-0.5">Categorical classification of flagged issues</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="category"
                  isAnimationActive={false}
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141937',
                    borderColor: '#1e2652',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Datasets Table */}
      <div className="rounded-xl bg-navy-800 border border-navy-700/80 overflow-hidden">
        <div className="p-5 border-b border-navy-700/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Recent Datasets</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Datasets uploaded and processed by the DataFix autonomous engine
            </p>
          </div>
          <Link
            href="/upload"
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
          >
            Upload More <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          {datasets.length === 0 && !loading ? (
            <div className="p-12 text-center">
              <Database className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No datasets uploaded yet</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                Get started by uploading your first tabular CSV or Excel dataset or explore our sample dataset.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Link
                  href="/upload"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Upload Dataset
                </Link>
                <Link
                  href="/upload?demo=true"
                  className="px-4 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-gray-200 text-xs font-semibold"
                >
                  Try Sample Dataset
                </Link>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-navy-900/70 text-xs font-semibold uppercase text-gray-400 border-b border-navy-700/60">
                <tr>
                  <th className="py-3.5 px-4">Dataset Name</th>
                  <th className="py-3.5 px-4">Upload Date</th>
                  <th className="py-3.5 px-4">Total Rows</th>
                  <th className="py-3.5 px-4">Errors Detected</th>
                  <th className="py-3.5 px-4">Quality Score</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/50">
                {datasets.map((ds) => {
                  const score = Math.round(ds.quality_score || 0);
                  const scoreColor =
                    score >= 85 ? 'text-emerald-400 bg-emerald-500/10' : score >= 60 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';

                  return (
                    <tr key={ds.id} className="hover:bg-navy-750/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate max-w-[200px]" title={ds.name}>
                          {ds.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {ds.upload_date ? new Date(ds.upload_date).toLocaleDateString() : 'Just now'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono">
                        {(ds.row_count || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                          {ds.error_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold ${scoreColor}`}>
                          {score}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-navy-700 text-gray-300">
                          {ds.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/analysis?dataset=${ds.id}`)}
                            title="Analyze Dataset"
                            className="p-1.5 rounded hover:bg-navy-700 text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <Search className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/repair?dataset=${ds.id}`)}
                            title="Repair Centre"
                            className="p-1.5 rounded hover:bg-navy-700 text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDatasetToDelete({ id: ds.id, name: ds.name })}
                            title="Delete Dataset"
                            className="p-1.5 rounded hover:bg-navy-700 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {datasetToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Delete Dataset?</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to permanently delete:
                </p>
              </div>
            </div>

            <div className="bg-navy-950 border border-navy-800 rounded-lg p-3">
              <p className="font-semibold text-xs text-white break-all">
                {datasetToDelete.name}
              </p>
              <p className="text-[11px] text-gray-400 font-mono mt-1">
                ID: {datasetToDelete.id}
              </p>
            </div>

            <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3 text-xs text-gray-300 space-y-1.5">
              <p className="font-medium text-red-400">This action will permanently remove:</p>
              <ul className="list-disc list-inside text-[11px] text-gray-400 space-y-0.5 ml-1">
                <li>Original uploaded file.</li>
                <li>Cleaned dataset.</li>
                <li>Detected issues.</li>
                <li>Repair suggestions.</li>
                <li>Repair history.</li>
                <li>Audit records associated with this dataset.</li>
                <li>Generated reports.</li>
                <li>Dataset metadata.</li>
              </ul>
              <p className="text-[11px] text-red-400 font-medium pt-1">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDatasetToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg border border-navy-700 hover:bg-navy-800 text-gray-300 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-red-600/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
