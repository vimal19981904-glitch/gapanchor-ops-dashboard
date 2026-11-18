'use client';

import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Edit3,
  Eye,
  Save,
  Sparkles,
  Compass,
  CheckCircle2,
  Clock,
  Flame,
  FileText,
  Tag,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Briefcase,
  Calendar,
  CheckSquare,
  Square,
  Terminal,
  HelpCircle,
  ShieldCheck,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { jarvisAudioFx } from '@/lib/jarvis-audio-fx';

interface CustomerExperienceTabProps {
  enquiry: any;
  latestCall?: {
    id: string;
    summary: string;
    customerExperience?: string | null;
    clientNeed?: string | null;
    budget?: string | null;
    timeline?: string | null;
    decisionMaker?: string | null;
    objections?: string | null;
    counterPitch?: string | null;
    nextAction?: string | null;
    score?: number;
  } | null;
  onSaveCX?: (updatedCX: string) => Promise<void>;
  onOpenUploadModal?: () => void;
}

export function CustomerExperienceTab({
  enquiry,
  latestCall,
  onSaveCX,
  onOpenUploadModal,
}: CustomerExperienceTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ONLY populate if genuine customerExperience exists on the analyzed call record
  const storedCX = latestCall?.customerExperience?.trim() || '';
  const [cxText, setCxText] = useState(storedCX);

  // Sync state if latestCall or enquiry changes
  React.useEffect(() => {
    const updated = latestCall?.customerExperience?.trim() || '';
    setCxText(updated);
    setIsEditing(false);
  }, [latestCall?.customerExperience, enquiry?.id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cxText);
    setCopied(true);
    toast.success('Dossier copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = () => {
    setCxText(latestCall?.customerExperience?.trim() || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!onSaveCX) return;
    setIsSaving(true);
    try {
      await onSaveCX(cxText);
      setIsEditing(false);
      toast.success('Dossier saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save summary');
    } finally {
      setIsSaving(false);
    }
  };

  // Interactive Action Item Checkbox / Status Toggle (Pending <-> Done)
  const handleToggleActionStatus = async (itemText: string, currentStatus: string) => {
    const isCurrentlyDone = /done|completed|confirmed/i.test(currentStatus);
    const newStatus = isCurrentlyDone ? 'Pending' : 'Done';
    const cleanItem = itemText.trim();
    if (!cleanItem) return;

    const lines = cxText.split(/\r?\n/);
    let changed = false;

    const newLines = lines.map((line) => {
      if (changed) return line;
      const cleanLine = line.trim();

      // Must match the actual action item text directly
      if (
        cleanLine.includes(cleanItem) ||
        (cleanItem.length > 8 && cleanLine.toLowerCase().includes(cleanItem.toLowerCase()))
      ) {
        changed = true;
        // Replace current status with new status in this exact line
        if (line.includes(currentStatus)) {
          return line.replace(currentStatus, newStatus);
        } else if (/pending/i.test(line)) {
          return line.replace(/pending/i, newStatus);
        } else if (/done|completed/i.test(line)) {
          return line.replace(/done|completed/i, newStatus);
        }
      }
      return line;
    });

    if (!changed) {
      console.warn('[CustomerExperienceTab] Could not locate line matching action item:', cleanItem);
      return;
    }

    const updatedText = newLines.join('\n');
    setCxText(updatedText);

    try {
      if (newStatus === 'Done') {
        try { jarvisAudioFx.playSuccessChime(); } catch {}
        toast.success(`Action marked as Done: ${cleanItem.slice(0, 35)}...`);
      } else {
        toast.info(`Action reopened as Pending: ${cleanItem.slice(0, 35)}...`);
      }
      if (onSaveCX) {
        await onSaveCX(updatedText);
      }
    } catch (err: any) {
      toast.error('Failed to update action status');
    }
  };

  // Compute Action Item Completion Stats
  const actionStats = useMemo(() => {
    const lines = (cxText || '').split(/\r?\n/);
    let total = 0;
    let completed = 0;

    for (const line of lines) {
      const isTableRow = line.includes('\t') || line.includes('|');
      if (!isTableRow) continue;

      if (/pending/i.test(line) && (/gapanchor/i.test(line) || /share/i.test(line) || /check/i.test(line) || /explore/i.test(line) || /send/i.test(line) || /confirm/i.test(line) || /schedule/i.test(line) || /action/i.test(line))) {
        total++;
      } else if (/done|completed/i.test(line) && (/gapanchor/i.test(line) || /share/i.test(line) || /check/i.test(line) || /explore/i.test(line) || /send/i.test(line) || /confirm/i.test(line) || /schedule/i.test(line) || /action/i.test(line))) {
        total++;
        completed++;
      }
    }
    return {
      total,
      completed,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [cxText]);

  // Extract Lead Score & Lead Temperature
  const leadScore = useMemo(() => {
    const match = (cxText || '').match(/Overall Lead Assessment:\s*([0-9.]+)\s*\/\s*10/i);
    return match ? match[1] : (latestCall?.score ? `${latestCall.score}/10` : '7.5/10');
  }, [cxText, latestCall?.score]);

  const leadTemp = useMemo(() => {
    const match = (cxText || '').match(/Lead Temperature:\s*([^\n\r]+)/i);
    return match ? match[1].trim() : 'Warm';
  }, [cxText]);

  // Dynamic Multi-Column Markdown & Tab Table Parser with Interactive Checkboxes
  const renderTableBlock = (rows: string[], keyPrefix: number) => {
    if (rows.length === 0) return null;

    const matrix: string[][] = [];
    for (const r of rows) {
      if (/^[\-\|\s:]+$/.test(r)) continue; // skip markdown divider |---|---|
      let parts: string[] = [];
      if (r.includes('\t')) {
        parts = r.split('\t').map((s) => s.trim());
      } else if (r.includes('|')) {
        parts = r
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        parts = [r.trim()];
      }
      if (parts.some(Boolean)) {
        matrix.push(parts);
      }
    }

    if (matrix.length === 0) return null;

    const headerRow = matrix[0];
    const dataRows = matrix.slice(1);

    // Check if this table contains an actionable status column
    const statusColIdx = headerRow.findIndex((h) => /status/i.test(h));
    const actionColIdx = headerRow.findIndex((h) => /action/i.test(h) || /item/i.test(h) || /task/i.test(h));
    const isActionTable = statusColIdx !== -1 && actionColIdx !== -1;

    return (
      <div
        key={`tbl-${keyPrefix}`}
        className="my-3.5 overflow-x-auto rounded-xl border border-slate-800 bg-[#070d18]/90 shadow-xl"
      >
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800/90 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/70 font-mono">
              {isActionTable && (
                <th className="py-2.5 px-3 font-bold w-10 text-center text-cyan-400">
                  Done
                </th>
              )}
              {headerRow.map((col, cIdx) => (
                <th
                  key={cIdx}
                  className={`py-2.5 px-3.5 font-bold ${
                    cIdx === headerRow.length - 1 && isActionTable ? 'text-right' : ''
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {dataRows.map((rowCells, rIdx) => {
              const statusVal = statusColIdx !== -1 ? rowCells[statusColIdx] || 'Pending' : '';
              const isDone = /done|completed|confirmed/i.test(statusVal);
              const isAwaiting = /awaiting|waiting/i.test(statusVal);
              const actionItemText = actionColIdx !== -1 ? rowCells[actionColIdx] || '' : '';

              return (
                <tr
                  key={rIdx}
                  className={`transition-colors ${
                    isDone ? 'bg-emerald-950/10 hover:bg-emerald-950/20' : 'hover:bg-slate-900/40'
                  }`}
                >
                  {/* Interactive Checkbox for Action Items */}
                  {isActionTable && (
                    <td className="py-2.5 px-3 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => handleToggleActionStatus(actionItemText, statusVal)}
                        className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-white transition-all cursor-pointer group"
                        title={isDone ? 'Mark as Pending' : 'Mark as Done'}
                      >
                        {isDone ? (
                          <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded border border-slate-600 group-hover:border-amber-400 group-hover:bg-amber-500/10 transition-colors" />
                        )}
                      </button>
                    </td>
                  )}

                  {rowCells.map((cell, cIdx) => {
                    const isStatusCell = cIdx === statusColIdx && isActionTable;
                    const isActionCell = cIdx === actionColIdx && isActionTable;
                    const isPriorityCell = /priority/i.test(headerRow[cIdx]);

                    // Priority Column Badging (High, Medium, Later)
                    if (isPriorityCell) {
                      const isHigh = /high/i.test(cell);
                      const isMed = /medium/i.test(cell);
                      return (
                        <td key={cIdx} className="py-2.5 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isHigh
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : isMed
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            <span>{cell}</span>
                          </span>
                        </td>
                      );
                    }

                    // Interactive Status Cell
                    if (isStatusCell) {
                      return (
                        <td key={cIdx} className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleActionStatus(actionItemText, statusVal)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                              isDone
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                : isAwaiting
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                            }`}
                            title="Click to toggle Pending / Done status"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-400" />
                            )}
                            <span>{cell}</span>
                          </button>
                        </td>
                      );
                    }

                    // Action Item Cell
                    if (isActionCell) {
                      return (
                        <td key={cIdx} className="py-2.5 px-3.5 font-medium">
                          <span
                            className={`transition-colors ${
                              isDone ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {cell}
                          </span>
                        </td>
                      );
                    }

                    // General Feasibility Cell (e.g. "Not feasible", "Preferred")
                    const isFeasible = /preferred|feasible/i.test(cell) && !/not feasible/i.test(cell);
                    const isNotFeasible = /not feasible/i.test(cell);
                    const isYes = /^yes$/i.test(cell.trim()) || /^yes\s+/i.test(cell.trim());

                    if (isNotFeasible) {
                      return (
                        <td key={cIdx} className="py-2.5 px-3.5 text-rose-300 font-semibold">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px]">
                            {cell}
                          </span>
                        </td>
                      );
                    }

                    if (isFeasible || isYes) {
                      return (
                        <td key={cIdx} className="py-2.5 px-3.5 text-emerald-300 font-semibold">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px]">
                            {cell}
                          </span>
                        </td>
                      );
                    }

                    // Currency or pricing cell
                    if (/₹|k\b/i.test(cell)) {
                      return (
                        <td key={cIdx} className="py-2.5 px-3.5 text-cyan-300 font-mono font-bold">
                          {cell}
                        </td>
                      );
                    }

                    // Regular cell
                    return (
                      <td key={cIdx} className="py-2.5 px-3.5 text-slate-300">
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Structured Dossier Document Renderer
  const renderedContent = useMemo(() => {
    const raw = cxText || '';
    const lines = raw.split(/\r?\n/);
    const elements: React.ReactNode[] = [];

    let tableBuffer: string[] = [];

    const flushTable = (keyPrefix: number) => {
      if (tableBuffer.length === 0) return;
      const tbl = renderTableBlock(tableBuffer, keyPrefix);
      if (tbl) elements.push(tbl);
      tableBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        flushTable(i);
        continue;
      }

      // Check table row (contains tab or pipe)
      const isTableRow =
        trimmed.includes('\t') ||
        (trimmed.includes('|') && !trimmed.startsWith('GapAnchor –') && !trimmed.startsWith('Call Summary'));

      if (isTableRow) {
        tableBuffer.push(trimmed);
        continue;
      } else {
        flushTable(i);
      }

      // 1. Document Title: GapAnchor – Lead Discussion Summary
      if (/^(GapAnchor\s*[–-]\s*Lead Discussion Summary|Call Summary)/i.test(trimmed)) {
        elements.push(
          <div
            key={i}
            className="pb-3 mb-2 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  {trimmed}
                </h2>
                <span className="text-[10px] text-slate-400 font-mono">
                  Verified Executive Record · GapAnchor Consulting
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Score: {leadScore}/10
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {leadTemp} Lead
              </span>
            </div>
          </div>
        );
        continue;
      }

      // 2. Lead Metadata Header lines: Prospect, Interested Program, Lead Status, Priority
      if (/^(Prospect|Interested Program|Lead Status|Priority):\s*/i.test(trimmed)) {
        const [label, ...rest] = trimmed.split(':');
        const val = rest.join(':').trim();
        const isPriority = /priority/i.test(label);
        const isStatus = /status/i.test(label);

        elements.push(
          <div
            key={i}
            className="flex items-center gap-2 py-0.5 text-xs text-slate-300"
          >
            <span className="font-semibold text-slate-400 text-[11px] min-w-[130px]">
              {label}:
            </span>
            <span
              className={`font-semibold ${
                isPriority
                  ? 'text-amber-300'
                  : isStatus
                  ? 'text-cyan-300'
                  : 'text-white'
              }`}
            >
              {val}
            </span>
          </div>
        );
        continue;
      }

      // 3. Section Headings: e.g. "1. Candidate Profile", "2. Training Requirements", etc.
      const isNumberedHeading = /^\d+\.\s+[A-Za-z]/i.test(trimmed);
      const isNamedHeading =
        /^CRM Lead Status/i.test(trimmed) ||
        /^Immediate Follow-up Actions/i.test(trimmed);

      if (isNumberedHeading || isNamedHeading) {
        elements.push(
          <div key={i} className="pt-5 pb-1">
            <h3 className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span>{trimmed}</span>
            </h3>
            <div className="w-full h-px bg-gradient-to-r from-slate-700 via-slate-800 to-transparent mt-1.5" />
          </div>
        );
        continue;
      }

      // 4. Highlighted Callouts / Subsections
      if (/^Hands-on Clarification:?/i.test(trimmed)) {
        elements.push(
          <div key={i} className="pt-3 pb-1 flex items-center gap-2 text-cyan-300 text-xs font-bold">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hands-on System Access & Remote Control</span>
          </div>
        );
        continue;
      }

      if (/^Pricing (Feedback & Sensitivity|sensitivity):?/i.test(trimmed)) {
        elements.push(
          <div key={i} className="pt-3 pb-1 flex items-center gap-2 text-amber-300 text-xs font-bold">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Pricing Feedback & Conversion Sensitivity</span>
          </div>
        );
        continue;
      }

      if (/^(Core Scheduling Barrier|Scheduling Requirements):?/i.test(trimmed)) {
        elements.push(
          <div key={i} className="pt-3 pb-1 flex items-center gap-2 text-rose-300 text-xs font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Shift Conflict & Batch Timing Feasibility</span>
          </div>
        );
        continue;
      }

      if (/^Overall Lead Assessment:\s*/i.test(trimmed)) {
        const val = trimmed.replace(/^Overall Lead Assessment:\s*/i, '');
        elements.push(
          <div
            key={i}
            className="my-3 p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-900 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono font-bold text-base">
                {val}
              </div>
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                  Lead Qualification Scorecard
                </span>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Assessed from real call dialogue, technical maturity & conversion probability
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>High Potential</span>
            </div>
          </div>
        );
        continue;
      }

      if (/^Why this is a promising lead:?/i.test(trimmed)) {
        elements.push(
          <div key={i} className="pt-2 pb-0.5 flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Why this is a promising lead</span>
          </div>
        );
        continue;
      }

      if (/^Primary conversion barriers:?/i.test(trimmed)) {
        elements.push(
          <div key={i} className="pt-2 pb-0.5 flex items-center gap-1.5 text-rose-400 text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Primary conversion barriers</span>
          </div>
        );
        continue;
      }

      if (/^Overall outcome:\s*/i.test(trimmed)) {
        const text = trimmed.replace(/^Overall outcome:\s*/i, '');
        elements.push(
          <div
            key={i}
            className="my-4 p-4 rounded-xl bg-gradient-to-r from-emerald-950/25 via-slate-900/70 to-slate-900/70 border-l-4 border-emerald-400 border-y border-r border-emerald-500/20 flex items-start gap-3 shadow-lg"
          >
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Overall Outcome & Directive
              </span>
              <p className="text-xs sm:text-sm font-medium text-slate-200 mt-1 leading-relaxed">
                {text}
              </p>
            </div>
          </div>
        );
        continue;
      }

      // 5. Bullet Items (lines starting with •, -, *)
      if (/^[•\-\*]\s+/.test(trimmed)) {
        const bulletText = trimmed.replace(/^[•\-\*]\s+/, '');
        elements.push(
          <div
            key={i}
            className="flex items-start gap-2.5 py-1 text-xs sm:text-sm text-slate-200 leading-relaxed pl-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0 shadow-[0_0_6px_rgba(129,140,248,0.6)]" />
            <span>{bulletText}</span>
          </div>
        );
        continue;
      }

      // 6. Regular paragraphs / body sentences
      elements.push(
        <p key={i} className="py-1 text-xs sm:text-sm text-slate-200 leading-relaxed pl-1">
          {trimmed}
        </p>
      );
    }

    flushTable(lines.length);

    return elements;
  }, [cxText, leadScore, leadTemp]);

  // Empty State: Lead has no call transcript or customer experience summary recorded yet
  if (!cxText && !isEditing) {
    return (
      <div className="py-14 px-6 rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/40 text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/10 via-indigo-500/10 to-emerald-500/10 border border-slate-700/60 text-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/5">
          <Sparkles className="w-6 h-6 text-cyan-400" />
        </div>

        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-sm font-bold text-white tracking-tight">
            No Call Transcript Dossier
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            AI Customer Experience & Lead Dossiers are populated once a Microsoft Teams call transcript is uploaded or analyzed. No transcript has been processed for{' '}
            <span className="text-slate-200 font-semibold">{enquiry?.participantName || 'this candidate'}</span> yet.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
          {onOpenUploadModal && (
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-b from-white/[0.18] to-white/[0.06] hover:from-white/[0.24] hover:to-white/[0.10] text-xs font-bold text-white shadow-[0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] border border-white/25 backdrop-blur-xl cursor-pointer transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Upload / Paste Teams Transcript</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold cursor-pointer transition-all"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            <span>Write Manual Notes</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ── Top Executive Notepad Toolbar ── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-700/80 shadow-2xl flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 via-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center shadow-lg">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Executive Dossier & Notepad</span>
              </h3>
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                {enquiry?.leadCode || `#${enquiry?.id?.slice(-6)}`}
              </span>
              {actionStats.total > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCheck className="w-3 h-3 text-emerald-400" />
                  <span>
                    {actionStats.completed}/{actionStats.total} Actions Done ({actionStats.pct}%)
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live interactive action items, pricing intelligence & scheduling feasibility
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Copy full dossier to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>Copy Dossier</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isEditing
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isEditing ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Dossier View</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Edit Notepad</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mode A: Raw Markdown / Text Editor */}
      {isEditing ? (
        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">
              Edit Notepad & Dossier Markdown
            </span>
            <span className="font-mono text-[10px]">Direct CRM persistence enabled</span>
          </div>

          <textarea
            value={cxText}
            onChange={(e) => setCxText(e.target.value)}
            rows={24}
            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl p-4 text-xs sm:text-sm text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
            placeholder="Paste or write Customer Experience call summary..."
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-b from-white/[0.18] to-white/[0.06] hover:from-white/[0.24] hover:to-white/[0.10] text-white text-xs font-bold shadow-[0_2px_10px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)] border border-white/25 backdrop-blur-xl transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Mode B: Executive Notepad Dossier View */
        <div className="p-6 rounded-2xl bg-[#090f1d] border border-slate-800/90 shadow-2xl backdrop-blur-md space-y-1 relative">
          {/* Subtle Notepad Top Accent Strip */}
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500" />
          {renderedContent}
        </div>
      )}
    </div>
  );
}

export default CustomerExperienceTab;
