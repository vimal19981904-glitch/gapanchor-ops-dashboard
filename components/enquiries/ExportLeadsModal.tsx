'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Download, FileSpreadsheet, FileText, GripVertical, Plus, Trash2,
  RefreshCw, Check, Search, ArrowUp, ArrowDown, Sparkles, Layers,
  ChevronRight, Eye
} from 'lucide-react';
import {
  EXPORTABLE_FIELDS,
  EXPORT_PRESETS,
  SelectedFieldItem,
  ExportFieldDefinition,
  generateExcelExport,
  generateCsvExport,
  formatCellValue
} from '@/lib/export-engine';
import { toast } from 'sonner';

interface ExportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredEnquiries: any[];
}

export default function ExportLeadsModal({
  isOpen,
  onClose,
  filteredEnquiries,
}: ExportLeadsModalProps) {
  // Current selected fields (order & custom label)
  const [selectedFields, setSelectedFields] = useState<SelectedFieldItem[]>(() => {
    const defaultKeys = EXPORT_PRESETS.default.keys;
    const fieldMap = new Map(EXPORTABLE_FIELDS.map((f) => [f.key, f]));
    return defaultKeys.map((k) => ({
      key: k,
      label: fieldMap.get(k)?.defaultLabel || k,
    }));
  });

  const [activePreset, setActivePreset] = useState<string>('default');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [availableSearch, setAvailableSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  // Freeze background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Map of available fields
  const selectedKeySet = useMemo(
    () => new Set(selectedFields.map((f) => f.key)),
    [selectedFields]
  );

  const availableFields = useMemo(() => {
    return EXPORTABLE_FIELDS.filter((f) => {
      const isNotSelected = !selectedKeySet.has(f.key);
      const matchesSearch =
        !availableSearch ||
        f.defaultLabel.toLowerCase().includes(availableSearch.toLowerCase()) ||
        f.key.toLowerCase().includes(availableSearch.toLowerCase()) ||
        f.category.toLowerCase().includes(availableSearch.toLowerCase());
      return isNotSelected && matchesSearch;
    });
  }, [selectedKeySet, availableSearch]);

  // Group available fields by category
  const groupedAvailable = useMemo(() => {
    const groups: Record<string, ExportFieldDefinition[]> = {};
    availableFields.forEach((f) => {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    });
    return groups;
  }, [availableFields]);

  // Field definition lookup
  const fieldDefMap = useMemo(
    () => new Map(EXPORTABLE_FIELDS.map((f) => [f.key, f])),
    []
  );

  if (!isOpen) return null;

  // Add field to selected list
  const handleAddField = (fieldDef: ExportFieldDefinition) => {
    setSelectedFields((prev) => [
      ...prev,
      { key: fieldDef.key, label: fieldDef.defaultLabel },
    ]);
    setActivePreset('custom');
  };

  // Add all currently filtered available fields
  const handleAddAllAvailable = () => {
    const toAdd = availableFields.map((f) => ({
      key: f.key,
      label: f.defaultLabel,
    }));
    setSelectedFields((prev) => [...prev, ...toAdd]);
    setActivePreset('custom');
  };

  // Remove field from selected list
  const handleRemoveField = (index: number) => {
    setSelectedFields((prev) => prev.filter((_, i) => i !== index));
    setActivePreset('custom');
  };

  // Clear all selected fields
  const handleClearAll = () => {
    setSelectedFields([]);
    setActivePreset('custom');
  };

  // Apply preset
  const handleApplyPreset = (presetKey: string) => {
    const preset = EXPORT_PRESETS[presetKey];
    if (!preset) return;
    const items = preset.keys.map((k) => ({
      key: k,
      label: fieldDefMap.get(k)?.defaultLabel || k,
    }));
    setSelectedFields(items);
    setActivePreset(presetKey);
  };

  // Update custom header title
  const handleUpdateHeader = (index: number, newLabel: string) => {
    setSelectedFields((prev) =>
      prev.map((item, i) => (i === index ? { ...item, label: newLabel } : item))
    );
    setActivePreset('custom');
  };

  // Move field up / down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedFields.length) return;
    setSelectedFields((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
    setActivePreset('custom');
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setSelectedFields((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(draggedIndex, 1);
      copy.splice(dropIndex, 0, removed);
      return copy;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
    setActivePreset('custom');
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Execute export download
  const handleExecuteExport = () => {
    if (selectedFields.length === 0) {
      toast.error('Please select at least one field to export.');
      return;
    }
    if (filteredEnquiries.length === 0) {
      toast.error('No matching leads to export.');
      return;
    }

    try {
      setExporting(true);
      let filename = '';
      if (format === 'xlsx') {
        filename = generateExcelExport(filteredEnquiries, selectedFields);
      } else {
        filename = generateCsvExport(filteredEnquiries, selectedFields);
      }
      toast.success(`Exported ${filteredEnquiries.length} leads to ${filename}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  // Preview data (first 3 records)
  const previewRows = filteredEnquiries.slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-only cursor-pointer"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-slate-950/98 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[-20px_0_90px_rgba(0,0,0,0.9)] text-slate-100 flex flex-col max-h-[92vh] overflow-hidden cursor-default"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-slate-300 shrink-0" />
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Advanced Lead Export
              </h2>
              <span className="text-xs text-slate-400 font-normal">
                ({filteredEnquiries.length} matching leads)
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Presets Bar */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-white/[0.08] bg-slate-900/40 flex items-center justify-between gap-3 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Presets:
            </span>
            {Object.entries(EXPORT_PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                  activePreset === key
                    ? 'bg-white/10 text-white border border-white/20 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 shrink-0">
            {selectedFields.length} of {EXPORTABLE_FIELDS.length} fields selected
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar text-xs">
          {/* Two-Column Drag & Drop Field Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Available Fields Pool (5 cols) */}
            <div className="lg:col-span-5 rounded-xl border border-white/10 bg-slate-900/60 p-3.5 flex flex-col h-[320px]">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
                <div className="font-bold text-slate-300 text-[11.5px] uppercase tracking-wider">
                  Available Fields ({availableFields.length})
                </div>
                {availableFields.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddAllAvailable}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                  >
                    + Add All
                  </button>
                )}
              </div>

              {/* Search box */}
              <div className="relative my-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter available fields..."
                  value={availableSearch}
                  onChange={(e) => setAvailableSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 bg-slate-950 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40"
                />
              </div>

              {/* Scrollable category list */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                {availableFields.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    All available fields have been added.
                  </div>
                ) : (
                  Object.entries(groupedAvailable).map(([category, fields]) => (
                    <div key={category} className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                        {category}
                      </div>
                      <div className="space-y-1">
                        {fields.map((f) => (
                          <div
                            key={f.key}
                            onClick={() => handleAddField(f)}
                            className="p-1.5 px-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-white/[0.06] hover:border-cyan-500/40 flex items-center justify-between cursor-pointer group transition"
                          >
                            <span className="font-medium text-slate-300 group-hover:text-white truncate">
                              {f.defaultLabel}
                            </span>
                            <span className="text-[10px] text-cyan-400 opacity-60 group-hover:opacity-100 flex items-center gap-0.5">
                              <Plus size={12} /> Add
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Selected Export Fields (7 cols) */}
            <div className="lg:col-span-7 rounded-xl border border-white/10 bg-slate-900/60 p-3.5 flex flex-col h-[320px]">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/[0.08]">
                <div className="font-bold text-slate-300 text-[11.5px] uppercase tracking-wider">
                  Selected Columns & Order ({selectedFields.length})
                </div>
                {selectedFields.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="text-[10.5px] text-slate-400 my-1.5 flex items-center justify-between">
                <span>Drag rows to reorder • Click header text to rename</span>
                <span>{selectedFields.length} columns</span>
              </div>

              {/* Scrollable draggable selected rows */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                {selectedFields.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No fields selected. Click or drag fields from the left column.
                  </div>
                ) : (
                  selectedFields.map((field, index) => {
                    const isDragging = draggedIndex === index;
                    const isDragOver = dragOverIndex === index;

                    return (
                      <div
                        key={field.key}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`p-1.5 px-2 rounded-lg border flex items-center justify-between gap-2 transition cursor-move select-none ${
                          isDragging
                            ? 'opacity-40 bg-slate-800 border-cyan-500/50'
                            : isDragOver
                            ? 'bg-slate-800/90 border-cyan-400 shadow-md'
                            : 'bg-slate-950/80 hover:bg-slate-800 border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <GripVertical size={14} className="text-slate-500 shrink-0 cursor-grab" />
                          <span className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center text-[10px] font-mono text-slate-400 shrink-0">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleUpdateHeader(index, e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-cyan-400 focus:bg-slate-900 rounded px-1.5 py-0.5 text-xs text-slate-200 font-semibold focus:outline-none w-full truncate"
                            title="Click to rename column header in export"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'up')}
                            className="p-1 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move column left/up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={index === selectedFields.length - 1}
                            onClick={() => handleMove(index, 'down')}
                            className="p-1 text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Move column right/down"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(index)}
                            className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                            title="Remove field from export"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Live Export Preview Table (Top 3 Rows) */}
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-slate-300 text-[11.5px] uppercase tracking-wider">
                  Live Export Preview (First 3 Records)
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400">
                Reflects selected order & custom column titles
              </span>
            </div>

            {selectedFields.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                Select columns above to see a live data preview.
              </div>
            ) : previewRows.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No matching leads in current filtered view.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-950 text-slate-300 border-b border-white/[0.08]">
                    <tr>
                      <th className="py-2 px-3 text-slate-500 font-mono w-8">#</th>
                      {selectedFields.map((field) => (
                        <th key={field.key} className="py-2 px-3 font-semibold whitespace-nowrap">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] bg-slate-950/60">
                    {previewRows.map((lead, rIdx) => (
                      <tr key={lead.id || rIdx} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 text-slate-500 font-mono">{rIdx + 1}</td>
                        {selectedFields.map((field) => {
                          const def = fieldDefMap.get(field.key);
                          const val = def ? formatCellValue(lead, def) : lead[field.key] ?? '';
                          return (
                            <td key={field.key} className="py-2 px-3 text-slate-300 whitespace-nowrap truncate max-w-[200px]">
                              {String(val || '—')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Format Selection */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Format:
            </span>
            <div className="inline-flex rounded-lg border border-white/10 bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  format === 'xlsx'
                    ? 'bg-white/10 text-white border border-white/15'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet size={13} />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  format === 'csv'
                    ? 'bg-white/10 text-white border border-white/15'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText size={13} />
                <span>CSV (.csv)</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={exporting || selectedFields.length === 0 || filteredEnquiries.length === 0}
              onClick={handleExecuteExport}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/20 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-2 shadow-sm"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-300" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-slate-300" />
                  <span>Download Export ({filteredEnquiries.length} Leads)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
