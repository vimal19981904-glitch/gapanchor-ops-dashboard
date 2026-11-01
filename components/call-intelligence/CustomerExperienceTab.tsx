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
} from 'lucide-react';
import { toast } from 'sonner';

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
    toast.success('Customer Experience Summary copied to clipboard!');
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
      toast.success('Customer Experience Summary saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Customer Experience summary');
    } finally {
      setIsSaving(false);
    }
  };

  // Extract Lead Temperature tag if present for header badge
  const leadTemp = useMemo(() => {
    const match = (cxText || '').match(/Lead Temperature:\s*([^\n\r]+)/i);
    return match ? match[1].trim() : null;
  }, [cxText]);

  // Unified single-document block renderer
  const renderedContent = useMemo(() => {
    const raw = cxText || '';
    const lines = raw.split(/\r?\n/);
    const elements: React.ReactNode[] = [];

    let tableBuffer: string[] = [];

    const flushTable = (keyPrefix: number) => {
      if (tableBuffer.length === 0) return;

      const rows = tableBuffer;
      tableBuffer = [];

      const parsedRows: Array<{ col1: string; col2: string }> = [];
      let isHeader = true;

      for (const r of rows) {
        if (/^[\-\|\s]+$/.test(r)) continue;

        let parts: string[] = [];
        if (r.includes('\t')) {
          parts = r.split('\t').map((s) => s.trim());
        } else if (r.includes('|')) {
          parts = r
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (r.includes(' - ')) {
          parts = r.split(' - ').map((s) => s.trim());
        } else {
          parts = [r.trim(), ''];
        }

        if (isHeader) {
          isHeader = false;
          // Skip redundant headers if matching Action Item / Status
          if (/action\s*item/i.test(parts[0]) && /status/i.test(parts[1])) {
            continue;
          }
        }

        if (parts[0]) {
          parsedRows.push({ col1: parts[0], col2: parts[1] || 'Pending' });
        }
      }

      if (parsedRows.length > 0) {
        elements.push(
          <div
            key={`tbl-${keyPrefix}`}
            className="my-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/40">
                  <th className="py-2.5 px-3.5 font-bold">Action Item</th>
                  <th className="py-2.5 px-3.5 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {parsedRows.map((row, idx) => {
                  const isDone = /done|completed|confirmed/i.test(row.col2);
                  const isAwaiting = /awaiting|waiting/i.test(row.col2);
                  return (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3.5 text-slate-200 font-medium">
                        {row.col1}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isDone
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : isAwaiting
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{row.col2}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        flushTable(i);
        continue;
      }

      // Check table row (contains tab or pipe or Action Item/Status header)
      const isTableRow =
        trimmed.includes('\t') ||
        (trimmed.includes('|') && !trimmed.startsWith('Call Summary')) ||
        /^(Action Item|Status)/i.test(trimmed);

      if (isTableRow) {
        tableBuffer.push(trimmed);
        continue;
      } else {
        flushTable(i);
      }

      // 1. Document Title: Call Summary – [Name] | GapAnchor Consulting
      if (/^Call Summary/i.test(trimmed)) {
        elements.push(
          <div
            key={i}
            className="pb-3 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {trimmed}
              </h2>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Executive Record
            </span>
          </div>
        );
        continue;
      }

      // 2. Purpose Callout
      if (/^Purpose:\s*/i.test(trimmed)) {
        const text = trimmed.replace(/^Purpose:\s*/i, '');
        elements.push(
          <div
            key={i}
            className="my-3 p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/30 via-slate-900/60 to-slate-900/60 border-l-4 border-cyan-400 border-y border-r border-slate-800/80 flex items-start gap-3"
          >
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                Call Purpose & Objective
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-100 mt-0.5 leading-relaxed">
                {text}
              </p>
            </div>
          </div>
        );
        continue;
      }

      // 3. Overall Outcome Callout
      if (/^Overall outcome:\s*/i.test(trimmed)) {
        const text = trimmed.replace(/^Overall outcome:\s*/i, '');
        elements.push(
          <div
            key={i}
            className="my-4 p-4 rounded-xl bg-gradient-to-r from-emerald-950/25 via-slate-900/70 to-slate-900/70 border-l-4 border-emerald-400 border-y border-r border-emerald-500/20 flex items-start gap-3"
          >
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Overall Outcome
              </span>
              <p className="text-xs sm:text-sm font-medium text-slate-200 mt-1 leading-relaxed">
                {text}
              </p>
            </div>
          </div>
        );
        continue;
      }

      // 4. Section Headings: e.g. "1. Lead Background", "2. Career Guidance Provided", "## Technical Evaluation", "CRM Lead Status"
      const isHeading =
        /^\d+\.\s+[A-Za-z]/i.test(trimmed) ||
        /^#{1,4}\s+/i.test(trimmed) ||
        /^CRM Lead Status/i.test(trimmed) ||
        /^Next Actions/i.test(trimmed);

      if (isHeading) {
        const headingText = trimmed.replace(/^#{1,4}\s+/, '');
        elements.push(
          <div key={i} className="pt-4 pb-1">
            <h3 className="text-xs sm:text-sm font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>{headingText}</span>
            </h3>
            <div className="w-full h-px bg-slate-800/80 mt-1.5" />
          </div>
        );
        continue;
      }

      // 5. CRM Key-Value Status tags: "Status: ...", "Lead Temperature: ...", "Next Step: ..."
      if (/^(Status|Lead Temperature|Next Step):\s*/i.test(trimmed)) {
        const [label, ...rest] = trimmed.split(':');
        const val = rest.join(':').trim();
        const isWarm = /warm/i.test(val);
        const isHot = /hot/i.test(val);

        elements.push(
          <div
            key={i}
            className="flex items-center gap-2.5 py-1 text-xs text-slate-300"
          >
            <span className="font-semibold text-slate-400 text-[11px] min-w-[110px]">
              {label}:
            </span>
            <span
              className={`font-semibold ${
                label.toLowerCase().includes('temperature')
                  ? isHot
                    ? 'text-rose-400'
                    : isWarm
                    ? 'text-amber-400'
                    : 'text-cyan-400'
                  : 'text-white'
              }`}
            >
              {val}
            </span>
          </div>
        );
        continue;
      }

      // 6. Bullet Items (lines starting with •, -, *)
      if (/^[•\-\*]\s+/.test(trimmed)) {
        const bulletText = trimmed.replace(/^[•\-\*]\s+/, '');
        elements.push(
          <div key={i} className="flex items-start gap-2.5 py-1 text-xs sm:text-sm text-slate-200 leading-relaxed pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
            <span>{bulletText}</span>
          </div>
        );
        continue;
      }

      // 7. Regular paragraphs / body sentences
      elements.push(
        <p key={i} className="py-1 text-xs sm:text-sm text-slate-200 leading-relaxed pl-1">
          {trimmed}
        </p>
      );
    }

    flushTable(lines.length);

    return elements;
  }, [cxText]);

  // Empty State: Lead has no call transcript or customer experience summary recorded yet
  if (!cxText && !isEditing) {
    return (
      <div className="py-14 px-6 rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/40 text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/10 via-indigo-500/10 to-emerald-500/10 border border-slate-700/60 text-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/5">
          <Sparkles className="w-6 h-6 text-cyan-400" />
        </div>

        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-sm font-bold text-white tracking-tight">
            No Call Transcript Summary
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            AI Customer Experience & Advisory summaries are only populated once a Microsoft Teams call transcript is uploaded or synced. No transcript has been analyzed for{' '}
            <span className="text-slate-200 font-semibold">{enquiry?.participantName || 'this candidate'}</span> yet.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
          {onOpenUploadModal && (
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-500/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
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
      {/* Top Banner & Control Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-indigo-500/20 backdrop-blur-md shadow-lg flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-0.5 shadow-md shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Customer Experience Summary
              </h3>
              {leadTemp && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                    leadTemp.toLowerCase().includes('hot')
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : leadTemp.toLowerCase().includes('warm')
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  }`}
                >
                  <Flame className="w-2.5 h-2.5" />
                  <span>{leadTemp}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Comprehensive AI call summary & advisory notes
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            title="Copy full Customer Experience summary to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>Copy Summary</span>
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
                <span>View Summary</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Edit Text</span>
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
              Edit Customer Experience Summary
            </span>
            <span>Edit or paste summary text from Claude, ChatGPT, or Gemini</span>
          </div>

          <textarea
            value={cxText}
            onChange={(e) => setCxText(e.target.value)}
            rows={22}
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
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Mode B: Unified Single Container Reader */
        <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800/80 shadow-2xl backdrop-blur-sm space-y-1">
          {renderedContent}
        </div>
      )}
    </div>
  );
}

export default CustomerExperienceTab;
