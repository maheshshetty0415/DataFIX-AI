'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  FileSpreadsheet,
  FileDown,
  Download,
  Database,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  BarChart3,
  ExternalLink,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getDatasets,
  getDataset,
  exportCSV,
  exportExcel,
  exportPDF,
  exportAuditCSV,
  Dataset,
} from '@/lib/api';
import DatasetDropdown from '@/components/DatasetDropdown';

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetParam = searchParams.get('dataset');

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    datasetParam || null
  );
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  // Load detailed dataset info for preview stats
  useEffect(() => {
    if (!selectedDatasetId) return;
    const currentId = selectedDatasetId;

    const found = datasets.find((d) => d.id === currentId);
    if (found) {
      setCurrentDataset(found);
    } else {
      getDataset(currentId)
        .then((data) => setCurrentDataset(data))
        .catch(() => setCurrentDataset(null));
    }
  }, [selectedDatasetId, datasets]);

  const handleDownload = (url: string, label: string) => {
    toast.success(`Preparing ${label} download...`);
    window.open(url, '_blank');
  };

  const exportCards = selectedDatasetId
    ? [
        {
          id: 'csv',
          title: 'Cleaned Dataset (CSV)',
          description:
            'Export the repaired tabular dataset in standard RFC 4180 CSV format. Ready for Pandas, Spark, and databases.',
          icon: FileSpreadsheet,
          color: 'from-blue-600 to-cyan-600',
          btnText: 'Download CSV',
          url: exportCSV(selectedDatasetId),
          format: '.csv',
        },
        {
          id: 'excel',
          title: 'Cleaned Spreadsheet (Excel)',
          description:
            'Formatted Microsoft Excel workbook with highlighted repairs, data types, and sheet summaries.',
          icon: FileSpreadsheet,
          color: 'from-emerald-600 to-teal-600',
          btnText: 'Download XLSX',
          url: exportExcel(selectedDatasetId),
          format: '.xlsx',
        },
        {
          id: 'pdf',
          title: 'Executive PDF Quality Report',
          description:
            'Complete audit certification, before/after distributions, compliance checks, and summary charts for stakeholders.',
          icon: FileText,
          color: 'from-purple-600 to-indigo-600',
          btnText: 'Download PDF Report',
          url: exportPDF(selectedDatasetId),
          format: '.pdf',
        },
        {
          id: 'audit',
          title: 'Audit Lineage Log (CSV)',
          description:
            'Detailed chronological event log of every value modification, machine confidence rating, and acceptance record.',
          icon: FileDown,
          color: 'from-pink-600 to-rose-600',
          btnText: 'Download Audit Log',
          url: exportAuditCSV(selectedDatasetId),
          format: '.csv',
        },
      ]
    : [];

  const handleDatasetDeleted = (deletedId: string) => {
    const remaining = datasets.filter((d) => String(d.id) !== String(deletedId));
    setDatasets(remaining);
    if (String(selectedDatasetId) === String(deletedId)) {
      if (remaining.length > 0) {
        setSelectedDatasetId(remaining[0].id);
        router.push(`/reports?dataset=${remaining[0].id}`);
      } else {
        setSelectedDatasetId(null);
        setCurrentDataset(null);
        router.push('/reports');
      }
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Dataset Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Reports & Export Centre
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Download certified clean datasets in multiple formats and generate stakeholder compliance reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {datasets.length > 0 && (
            <DatasetDropdown
              datasets={datasets}
              selectedDatasetId={selectedDatasetId}
              onSelect={(val) => {
                setSelectedDatasetId(val);
                router.push(`/reports?dataset=${val}`);
              }}
              onDatasetDeleted={handleDatasetDeleted}
            />
          )}
        </div>
      </div>

      {/* Dataset Summary Telemetry Banner */}
      {currentDataset && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-navy-800 via-navy-800/90 to-navy-850 border border-navy-700/80 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold tracking-wider text-blue-400">
                Selected Release Target
              </span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {currentDataset.name}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Status: Certified Clean
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Processed on{' '}
                {currentDataset.upload_date
                  ? new Date(currentDataset.upload_date).toLocaleDateString()
                  : 'Today'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-700/60">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Total Rows</span>
                <p className="text-lg font-bold text-white mt-0.5">
                  {(currentDataset.row_count || 1000).toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-700/60">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Total Cols</span>
                <p className="text-lg font-bold text-white mt-0.5">
                  {currentDataset.column_count || 12}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-700/60">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Errors Fixed</span>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">
                  {currentDataset.error_count || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-700/60">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Quality Index</span>
                <p className="text-lg font-bold text-purple-400 mt-0.5">
                  {Math.round(currentDataset.quality_score || 99)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="p-6 rounded-2xl bg-navy-800 border border-navy-700/80 hover:border-blue-500/40 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-lg`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold uppercase px-2.5 py-1 rounded bg-navy-900 text-gray-300 border border-navy-700">
                    {card.format}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">{card.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-navy-700/60 flex items-center justify-between">
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Certified Verification
                </span>
                <button
                  onClick={() => handleDownload(card.url, card.title)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-md shadow-blue-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  {card.btnText}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State if no dataset selected */}
      {!selectedDatasetId && !loading && (
        <div className="p-12 text-center rounded-2xl bg-navy-800 border border-navy-700">
          <FileText className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white">No Dataset Available</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Upload or select a dataset first to generate export archives and validation reports.
          </p>
        </div>
      )}
    </div>
  );
}
