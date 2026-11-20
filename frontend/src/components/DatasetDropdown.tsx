'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Database, ChevronDown, X, AlertTriangle, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { deleteDataset, Dataset } from '@/lib/api';

interface DatasetDropdownProps {
  datasets: Dataset[];
  selectedDatasetId: string | null;
  onSelect: (datasetId: string) => void;
  onDatasetDeleted?: (deletedId: string) => void;
  className?: string;
}

export default function DatasetDropdown({
  datasets,
  selectedDatasetId,
  onSelect,
  onDatasetDeleted,
  className = '',
}: DatasetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState<Dataset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        if (!isDeleting) {
          setDatasetToDelete(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    // Support query params for visual testing & accessibility inspection
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('showDropdown') === 'true' && datasets.length > 0) {
        setIsOpen(true);
      }
      if (params.get('showDeleteModal') === 'true' && datasets.length > 0) {
        setDatasetToDelete(datasets[0]);
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleting, datasets]);

  const currentDataset = datasets.find((d) => String(d.id) === String(selectedDatasetId));
  const currentDisplayName = currentDataset
    ? (currentDataset.name || currentDataset.original_filename || currentDataset.filename || `Dataset #${currentDataset.id}`)
    : 'Select a Dataset';

  const handleConfirmDelete = async () => {
    if (!datasetToDelete || isDeleting) return;
    setIsDeleting(true);
    const target = datasetToDelete;

    try {
      await deleteDataset(target.id);
      toast.success('Dataset permanently deleted.');
      setDatasetToDelete(null);
      setIsOpen(false);
      if (onDatasetDeleted) {
        onDatasetDeleted(target.id);
      }
    } catch (err: any) {
      console.error('Delete dataset error:', err);
      const errMsg = err?.response?.data?.detail || err?.message || 'Failed to delete dataset';
      toast.error(`Error deleting dataset: ${errMsg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        {/* Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2.5 bg-navy-800 hover:bg-navy-750 border border-navy-700 hover:border-navy-600 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[280px] sm:max-w-[340px]"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title={currentDisplayName}
        >
          <Database className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="truncate text-left flex-1">{currentDisplayName}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-400' : ''
            }`}
          />
        </button>

        {/* Custom Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute right-0 mt-1.5 w-72 sm:w-84 max-h-80 overflow-y-auto bg-navy-900 border border-navy-700/80 rounded-xl shadow-2xl shadow-black/80 z-50 py-1.5 divide-y divide-navy-800/60 focus:outline-none"
            role="listbox"
          >
            {datasets.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-400 text-center">
                No datasets available
              </div>
            ) : (
              datasets.map((d) => {
                const isSelected = String(d.id) === String(selectedDatasetId);
                const displayName = d.name || d.original_filename || d.filename || `Dataset #${d.id}`;
                const rowCount = d.total_rows ?? d.row_count ?? 0;

                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      onSelect(d.id);
                      setIsOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={`group relative flex items-center justify-between px-3.5 py-2.5 text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600/15 text-white'
                        : 'text-gray-300 hover:bg-navy-800/80 hover:text-white'
                    }`}
                  >
                    {/* Left: Dataset Name & Info */}
                    <div className="flex items-center gap-2 min-w-0 pr-2 flex-1">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-medium truncate ${
                            isSelected ? 'text-blue-400 font-semibold' : 'text-gray-200'
                          }`}
                          title={displayName}
                        >
                          {displayName}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                          #{String(d.id).slice(0, 8)} • {rowCount} rows
                        </p>
                      </div>
                    </div>

                    {/* Right: Small X / Trash Delete Icon */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // CRITICAL: Do not select dataset when clicking delete icon!
                        setDatasetToDelete(d);
                      }}
                      className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 ml-1 opacity-70 group-hover:opacity-100"
                      title="Delete Dataset"
                      aria-label={`Delete dataset ${displayName}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {datasetToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Header with warning icon */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 id="modal-title" className="text-lg font-bold text-white">
                  Delete Dataset?
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to permanently delete:
                </p>
              </div>
            </div>

            {/* Target Dataset Name Box */}
            <div className="bg-navy-950 border border-navy-800 rounded-lg p-3">
              <p className="font-semibold text-xs text-white break-all">
                {datasetToDelete.name || datasetToDelete.original_filename || datasetToDelete.filename || datasetToDelete.id}
              </p>
              <p className="text-[11px] text-gray-400 font-mono mt-1">
                ID: {datasetToDelete.id}
              </p>
            </div>

            {/* Warning Scope Description */}
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

            {/* Action Buttons */}
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
    </>
  );
}
