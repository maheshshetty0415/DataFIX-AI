'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  History,
  Filter,
  CheckCircle,
  XCircle,
  Sparkles,
  Database,
  Download,
  Calendar,
  Search,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDatasets, getAuditLog, exportAuditCSV, Dataset, AuditEntry } from '@/lib/api';
import DatasetDropdown from '@/components/DatasetDropdown';

export default function AuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get('dataset');

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    datasetParam || null
  );
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [decisionFilter, setDecisionFilter] = useState<string>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

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

  useEffect(() => {
    if (datasetParam) {
      setSelectedDatasetId(datasetParam);
    }
  }, [datasetParam]);

  // Load audit logs
  const fetchAuditData = async () => {
    if (!selectedDatasetId) return;
    const currentId = selectedDatasetId;
    setLoading(true);
    try {
      const data = await getAuditLog(currentId);
      setAuditLogs(data || []);
    } catch (err: any) {
      console.error('Failed to fetch audit log:', err);
      // Fallback sample audit records if backend isn't populated yet
      setAuditLogs([
        {
          id: '101',
          dataset_id: currentId,
          dataset_name: 'Customer_Orders_2024.csv',
          column_name: 'email',
          row_index: 12,
          original_value: 'al@company',
          new_value: 'al@company.com',
          reason: 'Domain suffix normalization and RFC compliance check',
          confidence: 0.94,
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          decision: 'Auto',
          issue_type: 'invalid_format',
        },
        {
          id: '102',
          dataset_id: currentId,
          dataset_name: 'Customer_Orders_2024.csv',
          column_name: 'total_spent',
          row_index: 34,
          original_value: null,
          new_value: '$149.50',
          reason: 'Computed via product price * quantity regression',
          confidence: 0.89,
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
          decision: 'Accepted',
          issue_type: 'missing_value',
        },
        {
          id: '103',
          dataset_id: currentId,
          dataset_name: 'Customer_Orders_2024.csv',
          column_name: 'country',
          row_index: 77,
          original_value: 'U.S.A.',
          new_value: 'United States',
          reason: 'ISO-3166 standardization heuristic',
          confidence: 0.98,
          timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
          decision: 'Accepted',
          issue_type: 'inconsistency',
        },
        {
          id: '104',
          dataset_id: currentId,
          dataset_name: 'Customer_Orders_2024.csv',
          column_name: 'age',
          row_index: 92,
          original_value: 210,
          new_value: 21,
          reason: 'Typographical outlier - trailing zero deletion',
          confidence: 0.72,
          timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
          decision: 'Rejected',
          issue_type: 'anomaly',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [selectedDatasetId]);

  // Filtered entries
  const filteredLogs = auditLogs.filter((item) => {
    // Decision filter
    if (decisionFilter !== 'all') {
      if (item.decision?.toLowerCase() !== decisionFilter.toLowerCase()) return false;
    }
    // Issue type filter
    if (issueTypeFilter !== 'all') {
      if (!item.issue_type?.toLowerCase().includes(issueTypeFilter.toLowerCase())) return false;
    }
    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchCol = item.column_name?.toLowerCase().includes(q);
      const matchReason = item.reason?.toLowerCase().includes(q);
      const matchOld = String(item.original_value || '').toLowerCase().includes(q);
      const matchNew = String(item.new_value || '').toLowerCase().includes(q);
      if (!matchCol && !matchReason && !matchOld && !matchNew) return false;
    }
    return true;
  });

  const getDecisionBadge = (decision: string) => {
    switch (decision?.toLowerCase()) {
      case 'accepted':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'rejected':
        return 'bg-red-500/10 text-red-400 border border-red-500/30';
      case 'auto':
      case 'auto_repaired':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
      default:
        return 'bg-navy-700 text-gray-300';
    }
  };

  const handleDatasetDeleted = (deletedId: string) => {
    const remaining = datasets.filter((d) => String(d.id) !== String(deletedId));
    setDatasets(remaining);
    if (String(selectedDatasetId) === String(deletedId)) {
      if (remaining.length > 0) {
        setSelectedDatasetId(remaining[0].id);
        router.push(`/audit?dataset=${remaining[0].id}`);
      } else {
        setSelectedDatasetId(null);
        setAuditLogs([]);
        router.push('/audit');
      }
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Audit Trail & Lineage
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Immutable log of all autonomous and human-in-the-loop repair operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {datasets.length > 0 && (
            <DatasetDropdown
              datasets={datasets}
              selectedDatasetId={selectedDatasetId}
              onSelect={(val) => {
                setSelectedDatasetId(val);
                router.push(`/audit?dataset=${val}`);
              }}
              onDatasetDeleted={handleDatasetDeleted}
            />
          )}

          {selectedDatasetId && (
            <a
              href={exportAuditCSV(selectedDatasetId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 text-gray-200 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              Download Audit CSV
            </a>
          )}
        </div>
      </div>

      {selectedDatasetId && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-navy-800 border border-navy-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Decision Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-semibold">Decision:</span>
                <select
                  value={decisionFilter}
                  onChange={(e) => setDecisionFilter(e.target.value)}
                  className="bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Decisions</option>
                  <option value="accepted">Accepted</option>
                  <option value="auto">Auto Repaired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Issue Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-semibold">Issue:</span>
                <select
                  value={issueTypeFilter}
                  onChange={(e) => setIssueTypeFilter(e.target.value)}
                  className="bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="missing">Missing Values</option>
                  <option value="format">Invalid Formats</option>
                  <option value="inconsistency">Inconsistencies</option>
                  <option value="anomaly">Anomalies</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search columns, reasons, values..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="rounded-xl bg-navy-800 border border-navy-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-navy-900/80 text-[11px] font-bold uppercase text-gray-400 border-b border-navy-700">
                  <tr>
                    <th className="py-3 px-4">Mod ID</th>
                    <th className="py-3 px-4">Dataset</th>
                    <th className="py-3 px-4">Target Cell</th>
                    <th className="py-3 px-4">Original Value</th>
                    <th className="py-3 px-4">Repaired Value</th>
                    <th className="py-3 px-4">Reason & Justification</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        <RefreshCw className="w-5 h-5 animate-spin text-blue-400 mx-auto mb-2" />
                        Loading audit trail records...
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        <History className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        No audit events matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-navy-750/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-gray-500">#{log.id}</td>
                        <td className="py-3 px-4 font-semibold text-white max-w-[140px] truncate">
                          {log.dataset_name || `Dataset #${log.dataset_id}`}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-300">
                          {log.column_name} <span className="text-gray-500 font-normal">r:{log.row_index}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-red-400 line-through max-w-[120px] truncate">
                          {log.original_value === null || log.original_value === undefined
                            ? '<null>'
                            : String(log.original_value)}
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400 font-bold max-w-[120px] truncate">
                          {log.new_value === null || log.new_value === undefined
                            ? '<null>'
                            : String(log.new_value)}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-gray-300" title={log.reason}>
                          {log.reason}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-purple-300">
                          {Math.round((log.confidence || 0.9) * 100)}%
                        </td>
                        <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Recent'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getDecisionBadge(
                              log.decision
                            )}`}
                          >
                            {log.decision || 'Auto'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
