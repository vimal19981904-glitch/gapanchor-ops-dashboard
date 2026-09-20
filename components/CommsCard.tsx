'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, AlertTriangle, Clock, CheckCircle2, Shield, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Mail, Filter, UserCheck } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { SkeletonCard } from '@/components/ui/Skeleton';
import AssignLeadModal from '@/components/AssignLeadModal';

interface Props {
  commsData: any;
  onRefresh: () => void;
  loading?: boolean;
  onOpenExcelModal?: () => void;
}

export default function CommsCard({ commsData, onRefresh, loading, onOpenExcelModal }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'whatsapp' | 'outlook'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetEnquiry, setTargetEnquiry] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  if (loading) return <SkeletonCard />;

  const { summary, enquiries = [], whatsappConfig = {} } = commsData || {};
  const { total = 0, staleCount = 0, openCount = 0, processedCount = 0, actionRequiredCount = 0, avgResponseTimeMins = 14 } = summary || {};

  const filteredEnquiries = enquiries.filter((e: any) => sourceFilter === 'all' || e.source === sourceFilter);
  const totalPages = Math.ceil(filteredEnquiries.length / pageSize) || 1;
  const paginatedEnquiries = filteredEnquiries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleFilterChange = (filter: 'all' | 'whatsapp' | 'outlook') => {
    setSourceFilter(filter);
    setCurrentPage(1);
  };

  const openAssignModal = (enquiry: any) => {
    setTargetEnquiry(enquiry);
    setAssignModalOpen(true);
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
    <div className="glass-card animate-slide-up flex flex-col justify-between !p-2.5 sm:!p-6 rounded-2xl sm:rounded-3xl">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-4 pb-2.5 sm:pb-4 border-b border-border/50">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Leads Command Center</h2>
                <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                  {total} Enquiries
                </span>
              </div>
              <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
                WhatsApp & Outlook Sync
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <Link
              href="/enquiries"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 transition-all cursor-pointer no-underline shrink-0 flex-1 sm:flex-auto justify-center"
            >
              <Filter size={12} className="sm:w-[13px] sm:h-[13px]" />
              <span>Full Intelligence Center ({total})</span>
            </Link>
            <div className="flex items-center justify-center gap-1.5 rounded-xl sm:rounded-full px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shrink-0">
              <Shield size={11} /> Server Token
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
          {[
            { label: 'Total Enquiries', value: total, color: 'text-brand-400' },
            { label: 'Avg Response', value: `${avgResponseTimeMins}m`, icon: Clock, color: 'text-cyan-400' },
            { label: 'Action Required', value: actionRequiredCount, color: actionRequiredCount > 0 ? 'text-rose-400' : 'text-emerald-400', alert: actionRequiredCount > 0 },
            { label: 'Open Enquiries', value: openCount, color: 'text-emerald-400' },
          ].map((m, i) => (
            <div key={i} className={`rounded-lg sm:rounded-xl border p-2 sm:p-3 ${m.alert ? 'border-rose-500/30 bg-rose-500/8' : 'border-border'}`} style={!m.alert ? { background: 'var(--surface-2)' } : {}}>
              <span className="text-[9px] sm:text-[10px] font-semibold block truncate" style={{ color: m.alert ? '#fb7185' : 'var(--text-tertiary)' }}>{m.label}</span>
              <div className={`text-base sm:text-xl font-extrabold mt-0.5 flex items-center gap-1.5 ${m.color}`}>
                {m.alert && <AlertTriangle size={13} className="sm:hidden" />}
                {m.alert && <AlertTriangle size={16} className="hidden sm:block" />}
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Enquiry threads */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              Enquiry Threads & Actions
            </h4>
            <div className="flex items-center gap-1 p-1 rounded-lg border border-border" style={{ background: 'var(--surface-0)' }}>
              <button onClick={() => handleFilterChange('all')} className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${sourceFilter === 'all' ? 'bg-surface-2 text-primary shadow-sm border border-border' : 'text-tertiary hover:text-secondary'}`}>All</button>
              <button onClick={() => handleFilterChange('whatsapp')} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${sourceFilter === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-tertiary hover:text-secondary'}`}><MessageSquare size={10} /> WhatsApp</button>
              <button onClick={() => handleFilterChange('outlook')} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${sourceFilter === 'outlook' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-tertiary hover:text-secondary'}`}><Mail size={10} /> Outlook</button>
            </div>
          </div>

          {paginatedEnquiries.length === 0 ? (
            <div className="p-8 text-center text-xs font-medium border border-dashed border-border rounded-xl" style={{ color: 'var(--text-tertiary)' }}>
              No enquiries found for this filter.
            </div>
          ) : (
            paginatedEnquiries.map((enq: any) => {
              const isExpanded = expandedId === enq.id;

              return (
                <div
                  key={enq.id}
                  className={`rounded-xl border p-2.5 sm:p-3 transition-all ${
                    enq.isStale ? 'border-rose-500/30 bg-rose-500/5' : 'border-border hover:border-border-secondary'
                  }`}
                  style={!enq.isStale ? { background: 'var(--surface-2)' } : {}}
                >
                  {/* Main Card Content */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Participant Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {enq.participantName}
                        </span>
                        <span className="text-[10px] font-mono shrink-0 opacity-70" style={{ color: 'var(--text-tertiary)' }}>
                          {enq.phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs font-semibold text-brand-400 flex items-center gap-1 truncate">
                          {enq.source === 'outlook' ? <Mail size={11} className="text-blue-400 shrink-0" /> : <MessageSquare size={11} className="text-emerald-400 shrink-0" />}
                          <span className="truncate">{enq.topic}</span>
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          • {formatRelativeTime(enq.messageTimestamp)}
                        </span>
                        {enq.staleReason && <span className="text-rose-400 text-[10px] font-medium">• {enq.staleReason}</span>}
                      </div>
                    </div>

                    {/* Uniform Alignment Bar: Status / Assignment Badge + Action Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t border-border/20 sm:border-t-0">
                      {/* Assignment Badge */}
                      {enq.assignedToName ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                          <UserCheck size={11} className="text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[130px] sm:max-w-[160px]">{enq.assignedToName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 shrink-0">
                          <UserCheck size={11} className="text-zinc-500 shrink-0 opacity-50" />
                          <span>Unassigned</span>
                        </span>
                      )}

                      {/* Action Button (Fixed Width for 100% Uniform Alignment Across Rows) */}
                      <button
                        onClick={() => openAssignModal(enq)}
                        title={enq.assignedToName ? `Currently assigned to ${enq.assignedToName}. Click to reassign.` : "Assign lead to employee"}
                        className="flex items-center justify-center gap-1.5 min-w-[90px] px-3 py-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-cyan-200 text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                      >
                        <UserCheck size={13} className="text-cyan-400 shrink-0" />
                        <span>{enq.assignedToName ? 'Reassign' : 'Assign'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable message preview */}
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/30">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : enq.id)}
                      className="text-[10px] flex items-center gap-1 font-medium hover:underline cursor-pointer"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      {isExpanded ? 'Hide message' : 'Show preview'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 animate-fade-in">
                      <p className="text-xs italic rounded-lg p-2.5 border border-border" style={{ background: 'var(--surface-0)', color: 'var(--text-secondary)' }}>
                        &ldquo;{enq.lastMessage}&rdquo;
                      </p>
                      {enq.processedNotes && (
                        <div className="mt-1.5 text-[10px] text-slate-300 bg-surface-1 p-2 rounded-lg border border-border/40 font-medium">
                          💬 {enq.processedNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border mt-3.5 pt-3 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="text-[11px]">
            Showing <span className="font-bold text-cyan-400">{(currentPage - 1) * pageSize + 1}</span>–<span className="font-bold text-cyan-400">{Math.min(currentPage * pageSize, filteredEnquiries.length)}</span> of <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{filteredEnquiries.length}</span> leads
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-2 hover:border-cyan-500/40 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
              style={{ background: 'var(--surface-0)', color: 'var(--text-primary)' }}
            >
              <ChevronLeft size={13} />
              <span>Previous</span>
            </button>
            <div className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-2 border border-border/50" style={{ color: 'var(--text-tertiary)' }}>
              Page <span className="font-bold text-cyan-400">{currentPage}</span> of {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl border border-border text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-2 hover:border-cyan-500/40 hover:text-cyan-300 transition-all cursor-pointer shadow-sm"
              style={{ background: 'var(--surface-0)', color: 'var(--text-primary)' }}
            >
              <span>Next</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
      {/* Assign Modal */}
      <AssignLeadModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        enquiryId={targetEnquiry?.id || null}
        participantName={targetEnquiry?.participantName}
        topic={targetEnquiry?.topic}
        currentAssignedId={targetEnquiry?.assignedToId}
        onSuccess={onRefresh}
      />
    </div>
  );
}
