'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  Search,
  RefreshCw,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadDataset, loadSampleDataset, analyzeDataset, DatasetPreview } from '@/lib/api';

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoParam = searchParams.get('demo');

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);

  // Handle demo mode auto load
  useEffect(() => {
    if (demoParam === 'true') {
      handleLoadSample();
    }
  }, [demoParam]);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles && rejectedFiles.length > 0) {
      toast.error('File rejected. Please upload a valid CSV or Excel file under 50MB.');
      return;
    }

    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      await startUpload(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
  });

  const startUpload = async (fileToUpload: File) => {
    setUploading(true);
    setUploadProgress(10);

    try {
      const data = await uploadDataset(fileToUpload, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      setPreview(data);
      toast.success('Dataset uploaded successfully!');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.detail || 'Failed to upload dataset.');
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSample = async () => {
    setUploading(true);
    setUploadProgress(30);
    try {
      const data = await loadSampleDataset();
      setPreview(data);
      setFile(null);
      setUploadProgress(100);
      toast.success('Sample dataset loaded successfully!');
    } catch (err: any) {
      console.error('Sample loading error:', err);
      toast.error('Failed to load sample dataset.');
    } finally {
      setUploading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!preview?.id) return;
    setAnalyzing(true);
    try {
      await analyzeDataset(preview.id);
      toast.success('Analysis completed! Redirecting...');
      router.push(`/analysis?dataset=${preview.id}`);
    } catch (err: any) {
      console.error('Analysis error:', err);
      // Navigate anyway in case it was analyzed
      router.push(`/analysis?dataset=${preview.id}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Ingest & Profiling
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Upload CSV or Excel files to begin autonomous anomaly detection and schema validation.
          </p>
        </div>

        <button
          onClick={handleLoadSample}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-gray-200 border border-navy-700 text-xs font-semibold transition-all self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Try Sample Dataset
        </button>
      </div>

      {/* Dropzone Container */}
      {!preview && (
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-navy-700 bg-navy-900/60 hover:border-navy-600 hover:bg-navy-850'
          }`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <p className="text-lg font-bold text-white">
                {isDragActive ? 'Drop your dataset here...' : 'Drag and drop your dataset here'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports CSV, XLSX, and XLS formats (Max size: 50MB)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow">
                Browse Files
              </span>
              <span className="text-xs text-gray-500">or drop directly onto this canvas</span>
            </div>
          </div>
        </div>
      )}

      {/* Uploading Status Progress */}
      {uploading && (
        <div className="p-6 rounded-xl bg-navy-800 border border-navy-700 space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-gray-300">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
              Uploading & parsing dataset...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-navy-950 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Dataset Preview Section */}
      {preview && (
        <div className="space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs text-gray-400 uppercase font-semibold">Total Rows</span>
              <p className="text-2xl font-bold text-white mt-1">
                {(preview.total_rows || preview.rows?.length || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs text-gray-400 uppercase font-semibold">Total Columns</span>
              <p className="text-2xl font-bold text-white mt-1">
                {preview.total_columns || preview.columns?.length || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs text-gray-400 uppercase font-semibold">Dataset ID</span>
              <p className="text-2xl font-bold text-blue-400 mt-1">#{preview.id}</p>
            </div>
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700">
              <span className="text-xs text-gray-400 uppercase font-semibold">Detected Schema</span>
              <p className="text-2xl font-bold text-purple-400 mt-1">Ready</p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-navy-800/80 border border-navy-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {preview.filename || preview.name || `Dataset #${preview.id}`}
                </h3>
                <p className="text-xs text-gray-400">
                  Ready for multi-layer anomaly detection and schema repair.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-navy-700 hover:bg-navy-600 text-xs font-semibold text-gray-300 transition-colors"
              >
                Upload Different File
              </button>
              <button
                onClick={handleStartAnalysis}
                disabled={analyzing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running Analysis...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Analyse Dataset
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Column Metadata Pills */}
          {preview.columns && preview.columns.length > 0 && (
            <div className="p-4 rounded-xl bg-navy-800 border border-navy-700 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Discovered Columns & Inferred Types
              </h4>
              <div className="flex flex-wrap gap-2">
                {preview.columns.map((col) => {
                  const type = preview.column_types?.[col] || 'string';
                  const nulls = preview.missing_values?.[col] || 0;
                  return (
                    <div
                      key={col}
                      className="px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-700/80 text-xs flex items-center gap-2"
                    >
                      <span className="font-semibold text-white">{col}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300">
                        {type}
                      </span>
                      {nulls > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300">
                          {nulls} nulls
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Table Preview (First 20 rows) */}
          <div className="rounded-xl bg-navy-800 border border-navy-700 overflow-hidden">
            <div className="p-4 border-b border-navy-700 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Data Sample (First 20 Rows)</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Inspect raw values prior to diagnostic analysis
                </p>
              </div>
              <span className="text-xs text-gray-400 font-mono">
                Showing {Math.min(20, preview.rows?.length || 0)} of{' '}
                {(preview.total_rows || preview.rows?.length || 0).toLocaleString()} records
              </span>
            </div>

            <div className="overflow-x-auto max-h-[460px]">
              {preview.rows && preview.rows.length > 0 ? (
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-navy-900/90 text-[11px] font-bold uppercase text-gray-400 border-b border-navy-700 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center text-gray-500 font-mono">#</th>
                      {preview.columns.map((col) => (
                        <th key={col} className="py-3 px-4 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {preview.rows.slice(0, 20).map((row, idx) => (
                      <tr key={idx} className="hover:bg-navy-750/50 transition-colors">
                        <td className="py-2.5 px-3 text-center text-gray-500 font-mono">{idx + 1}</td>
                        {preview.columns.map((col) => {
                          const val = row[col];
                          const isNull = val === null || val === undefined || val === '';
                          return (
                            <td
                              key={col}
                              className={`py-2.5 px-4 whitespace-nowrap font-mono ${
                                isNull ? 'text-red-400 italic bg-red-500/5' : 'text-gray-200'
                              }`}
                            >
                              {isNull ? '<null>' : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No preview rows available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
