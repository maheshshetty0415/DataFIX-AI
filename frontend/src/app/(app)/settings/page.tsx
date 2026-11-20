'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  Moon,
  Database,
  ShieldAlert,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  // Client settings state
  const [theme, setTheme] = useState('dark');
  const [maxPreviewRows, setMaxPreviewRows] = useState(20);
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [requireConfirmation, setRequireConfirmation] = useState(true);
  const [autoDeduplicate, setAutoDeduplicate] = useState(true);
  const [exportIncludeHeaders, setExportIncludeHeaders] = useState(true);

  // Load from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem('datafix_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.maxPreviewRows) setMaxPreviewRows(parsed.maxPreviewRows);
        if (parsed.dateFormat) setDateFormat(parsed.dateFormat);
        if (parsed.confidenceThreshold) setConfidenceThreshold(parsed.confidenceThreshold);
        if (parsed.requireConfirmation !== undefined)
          setRequireConfirmation(parsed.requireConfirmation);
        if (parsed.autoDeduplicate !== undefined) setAutoDeduplicate(parsed.autoDeduplicate);
        if (parsed.exportIncludeHeaders !== undefined)
          setExportIncludeHeaders(parsed.exportIncludeHeaders);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  const handleSave = () => {
    try {
      const toSave = {
        maxPreviewRows,
        dateFormat,
        confidenceThreshold,
        requireConfirmation,
        autoDeduplicate,
        exportIncludeHeaders,
      };
      localStorage.setItem('datafix_settings', JSON.stringify(toSave));
      toast.success('Engine preferences updated successfully!');
    } catch (e) {
      toast.error('Failed to save settings to local storage.');
    }
  };

  const handleReset = () => {
    setMaxPreviewRows(20);
    setDateFormat('YYYY-MM-DD');
    setConfidenceThreshold(85);
    setRequireConfirmation(true);
    setAutoDeduplicate(true);
    setExportIncludeHeaders(true);
    localStorage.removeItem('datafix_settings');
    toast.success('Preferences reset to default values.');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Engine Configuration
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure autonomous repair thresholds, dataset parsing defaults, and heuristics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-gray-400 hover:text-white border border-navy-700 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Application Theme */}
        <div className="p-6 rounded-2xl bg-navy-800 border border-navy-700/80 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Application Theme</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Display appearance styling for DataFix AI console
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md pt-2">
            <div className="p-4 rounded-xl border-2 border-blue-500 bg-navy-900 cursor-pointer flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Deep Navy Dark</span>
                <span className="text-[10px] text-gray-400">High contrast telemetry mode</span>
              </div>
              <CheckCircle className="w-4 h-4 text-blue-400" />
            </div>

            <div className="p-4 rounded-xl border border-navy-700 bg-navy-900/40 opacity-50 cursor-not-allowed flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 block">Light Minimal</span>
                <span className="text-[10px] text-gray-500">Coming soon in v2.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dataset Preferences */}
        <div className="p-6 rounded-2xl bg-navy-800 border border-navy-700/80 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Dataset Ingestion Preferences</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Default row sample sizes, temporal parsing, and export formatting
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">
                Default Sample Preview Rows
              </label>
              <select
                value={maxPreviewRows}
                onChange={(e) => setMaxPreviewRows(parseInt(e.target.value, 10))}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10 records</option>
                <option value={20}>20 records (Recommended)</option>
                <option value={50}>50 records</option>
                <option value={100}>100 records</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">
                Standard Date Normalization Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="YYYY-MM-DD">ISO 8601 (YYYY-MM-DD)</option>
                <option value="DD/MM/YYYY">European (DD/MM/YYYY)</option>
                <option value="MM/DD/YYYY">US Standard (MM/DD/YYYY)</option>
                <option value="YYYY-MM-DD HH:mm:ss">Timestamp (YYYY-MM-DD HH:mm:ss)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Repair Settings */}
        <div className="p-6 rounded-2xl bg-navy-800 border border-navy-700/80 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">AI Repair Settings</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Tune algorithmic thresholds for autonomous remediation
              </p>
            </div>
          </div>

          {/* Confidence Slider */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-300">
                Auto-Repair Minimum Confidence Threshold
              </span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {confidenceThreshold}%
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={99}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <p className="text-[11px] text-gray-400">
              Repairs with Bayesian likelihood below this threshold will require manual confirmation
              in the AI Repair Centre.
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4 pt-4 border-t border-navy-700/60">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-white block">
                  Require Confirmation for Critical Severity Fixes
                </span>
                <span className="text-[11px] text-gray-400">
                  Always require human review for changes that modify primary keys or outlier values
                </span>
              </div>
              <input
                type="checkbox"
                checked={requireConfirmation}
                onChange={(e) => setRequireConfirmation(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-navy-900 border-navy-600 focus:ring-0 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-white block">
                  Automatic Exact Deduplication
                </span>
                <span className="text-[11px] text-gray-400">
                  Automatically consolidate 100% duplicate row occurrences into a single primary record
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoDeduplicate}
                onChange={(e) => setAutoDeduplicate(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-navy-900 border-navy-600 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* About Section */}
        <div className="p-6 rounded-2xl bg-navy-800 border border-navy-700/80 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">About DataFix AI</h3>
              <p className="text-xs text-gray-400 mt-0.5">Platform runtime and version metadata</p>
            </div>
          </div>

          <div className="text-xs text-gray-300 space-y-2 pt-2 leading-relaxed">
            <p>
              <strong>DataFix AI Engine</strong> &mdash; Version 1.0.0 (Production Release)
            </p>
            <p className="text-gray-400">
              An Autonomous Data Quality and Repair Engine designed to eradicate dataset defects,
              normalize corrupted records, provide mathematical explainability, and guarantee clean
              data pipelines.
            </p>
            <div className="pt-2 text-[11px] text-gray-500">
              Built with Next.js 14, Tailwind CSS, Recharts, Framer Motion, and FastAPI.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
