'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, AlertTriangle, Clock, CheckCircle2, Shield, Zap, ChevronDown, ChevronUp, Mail, Filter } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface Props {
  commsData: any;
  onRefresh: () => void;
  loading?: boolean;
  onOpenExcelModal?: () => void;
}

export default function CommsCard({ commsData, onRefresh, loading, onOpenExcelModal }: Props) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processNotes, setProcessNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'whatsapp' | 'outlook'>('all');

  if (loading) return <SkeletonCard />;

  const { summary, enquiries = [], whatsappConfig = {} } = commsData || {};
  const { total = 0, staleCount = 0, openCount = 0, processedCount = 0, actionRequiredCount = 0, avgResponseTimeMins = 14 } = summary || {};

  // ──── PROCESS SINGLE ENQUIRY ─────────────────────
  const handleProcess = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process',
          enquiryId: id,
          notes: processNotes[id] || 'Processed via dashboard',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`✅ Enquiry processed — updated in database`, {
          description: `Status changed to "Processed" with timestamp`,
        });
        onRefresh();
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // ──── BULK PROCESS ────────────────────────────────
  const handleBulkProcess = async () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch('/api/comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_process',
          enquiryIds: selectedIds,
          notes: 'Bulk processed via dashboard',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`✅ ${selectedIds.length} enquiries processed`);
        setSelectedIds([]);
        onRefresh();
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Processed': return 'badge-processed';
      case 'Resolved': return 'badge-completed';
      case 'Action Required': return 'badge-stale';
      case 'Active': return 'badge-in-progress';
      default: return 'badge-open';
    }
  };

  return (
    <div className="glass-card animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center">
            <MessageSquare size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Leads Command Center</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                179 Excel Enquiries
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              WhatsApp, Outlook & Excel (`DemoEnquiry_Extracted.xlsx`)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/enquiries"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 transition-all cursor-pointer no-underline"
          >
            <Filter size={13} />
            <span>Full Intelligence Command Center ({total})</span>
          </Link>
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Shield size={11} /> Server Token
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Enquiries', value: total, color: 'text-brand-400' },
          { label: 'Avg Response', value: `${avgResponseTimeMins}m`, icon: Clock, color: 'text-cyan-400' },
          { label: 'Action Required', value: actionRequiredCount, color: actionRequiredCount > 0 ? 'text-rose-400' : 'text-emerald-400', alert: actionRequiredCount > 0 },
          { label: 'Processed', value: processedCount, color: 'text-emerald-400' },
        ].map((m, i) => (
          <div key={i} className={`rounded-xl border p-3 ${m.alert ? 'border-rose-500/30 bg-rose-500/8' : 'border-border'}`} style={!m.alert ? { background: 'var(--surface-2)' } : {}}>
            <span className="text-[10px] font-semibold" style={{ color: m.alert ? '#fb7185' : 'var(--text-tertiary)' }}>{m.label}</span>
            <div className={`text-xl font-extrabold mt-0.5 flex items-center gap-1.5 ${m.color}`}>
              {m.alert && <AlertTriangle size={16} />}
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border border-brand-500/30 bg-brand-500/10 animate-fade-in">
          <span className="text-xs font-semibold text-brand-400">{selectedIds.length} selected</span>
          <button onClick={handleBulkProcess} disabled={bulkProcessing} className="btn-process !py-1.5 !px-3 !text-xs">
            <Zap size={13} />
            {bulkProcessing ? 'Processing...' : 'Process Selected'}
          </button>
          <button onClick={() => setSelectedIds([])} className="text-xs font-medium hover:underline" style={{ color: 'var(--text-secondary)' }}>
            Clear
          </button>
        </div>
      )}

      {/* Enquiry threads */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            Enquiry Threads & Actions
          </h4>
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border" style={{ background: 'var(--surface-0)' }}>
            <button onClick={() => setSourceFilter('all')} className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${sourceFilter === 'all' ? 'bg-surface-2 text-primary shadow-sm border border-border' : 'text-tertiary hover:text-secondary'}`}>All</button>
            <button onClick={() => setSourceFilter('whatsapp')} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${sourceFilter === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-tertiary hover:text-secondary'}`}><MessageSquare size={10} /> WhatsApp</button>
            <button onClick={() => setSourceFilter('outlook')} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${sourceFilter === 'outlook' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-tertiary hover:text-secondary'}`}><Mail size={10} /> Outlook</button>
          </div>
        </div>

        {enquiries.filter((e: any) => sourceFilter === 'all' || e.source === sourceFilter).map((enq: any) => {
          const isExpanded = expandedId === enq.id;
          const isProcessed = enq.status === 'Processed' || enq.status === 'Resolved';
          const isProcessing = processingId === enq.id;

          return (
            <div
              key={enq.id}
              className={`rounded-xl border p-4 transition-all ${
                enq.isStale ? 'border-rose-500/30 bg-rose-500/5' : isProcessed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border hover:border-border-secondary'
              }`}
              style={!enq.isStale && !isProcessed ? { background: 'var(--surface-2)' } : {}}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* Checkbox for bulk select */}
                  {!isProcessed && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(enq.id)}
                      onChange={() => toggleSelect(enq.id)}
                      className="mt-1 w-4 h-4 rounded accent-brand-500 cursor-pointer"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{enq.participantName}</span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{enq.phone}</span>
                    </div>
                    <span className="text-xs font-semibold text-brand-400 flex items-center gap-1.5">
                      {enq.source === 'outlook' ? <Mail size={12} className="text-blue-400" /> : <MessageSquare size={12} className="text-emerald-400" />}
                      {enq.topic}
                    </span>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      {formatRelativeTime(enq.messageTimestamp)}
                      {enq.staleReason && <span className="text-rose-400 ml-2">• {enq.staleReason}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`badge ${getStatusBadge(enq.status)}`}>{enq.status}</span>
                  {/* ──── PROCESS BUTTON ──── */}
                  {!isProcessed && (
                    <button
                      onClick={() => handleProcess(enq.id)}
                      disabled={isProcessing}
                      className="btn-process !py-1.5 !px-3 !text-xs"
                    >
                      <Zap size={13} />
                      {isProcessing ? 'Processing...' : 'Process'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expandable message preview */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : enq.id)}
                className="mt-2 text-[10px] flex items-center gap-1 font-medium hover:underline"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {isExpanded ? 'Hide message' : 'Show message preview'}
              </button>

              {isExpanded && (
                <div className="mt-2 animate-fade-in">
                  <p className="text-xs italic rounded-lg p-3 border border-border" style={{ background: 'var(--surface-0)', color: 'var(--text-secondary)' }}>
                    &ldquo;{enq.lastMessage}&rdquo;
                  </p>
                  {/* Processing notes input */}
                  {!isProcessed && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Add processing notes (optional)..."
                        value={processNotes[enq.id] || ''}
                        onChange={(e) => setProcessNotes(prev => ({ ...prev, [enq.id]: e.target.value }))}
                        className="w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-brand-500"
                        style={{ background: 'var(--surface-0)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  )}
                  {/* Show processing details if processed */}
                  {isProcessed && enq.processedAt && (
                    <div className="mt-2 text-[10px] text-emerald-400 font-semibold">
                      ✅ Processed at {new Date(enq.processedAt).toLocaleString('en-IN')}
                      {enq.processedNotes && <span className="ml-2 font-normal" style={{ color: 'var(--text-secondary)' }}>— {enq.processedNotes}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
