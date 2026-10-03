'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  UserCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Layers,
  Edit3,
  User,
  AlertCircle,
  MapPin,
  DollarSign,
  PlusCircle
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';
import AssignLeadModal from '@/components/AssignLeadModal';

interface Props {
  jobSupportData: any;
  onRefresh: () => void;
  onOpenModal?: () => void;
  onEditSession?: (session: any) => void;
  loading?: boolean;
}

const targetPlatforms = ['Manhattan WMS', 'Cloud Architecture', 'Manhattan ProActive', 'Blue Yonder'];

export default function JobSupportCard({ jobSupportData, onRefresh, onOpenModal, onEditSession, loading }: Props) {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetEnquiry, setTargetEnquiry] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 3;

  if (loading) return <SkeletonCard />;

  const { summary = {}, jobSupportLeads = [], sessions = [] } = jobSupportData || {};
  const totalLeads = sessions.length > 0 ? sessions.length : (summary.totalLeads || jobSupportLeads.length || 0);
  const activeCount = sessions.length > 0 ? sessions.filter((s: any) => s.status !== 'Completed').length : (summary.activeCount || 0);
  const assignedCount = sessions.length > 0 ? sessions.filter((s: any) => s.trainer || s.engineer).length : (summary.assignedCount || 0);
  const pendingAssignCount = Math.max(0, totalLeads - assignedCount);

  // Platform breakdown counts
  const platformCounts: Record<string, number> = {};
  sessions.forEach((s: any) => {
    const p = s.platform || 'Other';
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });

  const openAssignModal = (lead: any) => {
    setTargetEnquiry(lead);
    setAssignModalOpen(true);
  };

  const allItems = sessions.length > 0 ? sessions : jobSupportLeads;
  const totalPages = Math.ceil(allItems.length / pageSize) || 1;
  const paginatedItems = allItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="glass-card animate-slide-up flex flex-col justify-between !p-2.5 sm:!p-6 rounded-2xl sm:rounded-3xl border border-cyan-500/20 bg-slate-900/60 backdrop-blur-xl h-full">
      <div>
        {/* Header (1:1 with Training Operations OpsCard) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-4 pb-2.5 sm:pb-4 border-b border-border/50">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Orange icon badge for logo as requested */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Briefcase size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Job Support Operations
                </h2>
                <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                  {totalLeads} {totalLeads === 1 ? 'Engagement' : 'Engagements'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                Dedicated 1-on-1 Engineer Assignments & Fee Tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <Link
              href="/job-support"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer no-underline shrink-0"
            >
              <Maximize2 size={12} />
              <span>Intelligence Deck</span>
            </Link>

            {onOpenModal && (
              <button
                onClick={onOpenModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 transition-all cursor-pointer shrink-0 flex-1 sm:flex-auto justify-center"
              >
                <PlusCircle size={12} className="sm:w-[13px] sm:h-[13px]" />
                <span>Add Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Metrics Grid (1:1 with Training Operations OpsCard) */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
          {[
            { label: 'Total 1-on-1', value: totalLeads, sub: 'Consultant/Client', color: 'text-indigo-400' },
            { label: 'Active Support', value: activeCount, sub: 'Scheduled', color: 'text-cyan-400' },
            { label: 'Assigned Eng', value: assignedCount, sub: 'Matched', color: 'text-emerald-400' },
            { label: 'Pending', value: pendingAssignCount, sub: 'Needs Engineer', color: pendingAssignCount > 0 ? 'text-rose-400' : 'text-slate-400', alert: pendingAssignCount > 0 },
          ].map((m, i) => (
            <div
              key={i}
              className={`rounded-lg sm:rounded-xl border p-2 sm:p-3 ${m.alert ? 'border-rose-500/30 bg-rose-500/10' : 'border-border'}`}
              style={!m.alert ? { background: 'var(--surface-2)' } : {}}
            >
              <span className="text-[9px] sm:text-[10px] font-semibold block truncate" style={{ color: m.alert ? '#fb7185' : 'var(--text-tertiary)' }}>
                {m.label}
              </span>
              <div className={`text-base sm:text-xl font-extrabold mt-0.5 flex items-center gap-1 ${m.color}`}>
                {m.alert && <AlertCircle size={13} className="text-rose-400 shrink-0" />}
                {m.value}
              </div>
              <span className="text-[9px] sm:text-[10px] block truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {m.sub}
              </span>
            </div>
          ))}
        </div>

        {/* Platform Overview (Matching OpsCard platform breakdown bar) */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3 sm:mb-4">
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border flex-wrap" style={{ background: 'var(--surface-0)' }}>
            {targetPlatforms.map((p) => (
              <span
                key={p}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Layers size={10} className="text-cyan-400 shrink-0" />
                <span>{p}:</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{platformCounts[p] || (p.includes('Manhattan') ? 1 : 0)}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 1-on-1 Support Engagements List */}
        <div className="space-y-2 sm:space-y-3">
          {allItems.length === 0 ? (
            <div
              className="p-8 text-center text-xs font-medium border border-dashed border-border rounded-xl"
              style={{ color: 'var(--text-tertiary)' }}
            >
              No Job Support sessions scheduled yet. Click &quot;Add Session&quot; to create a new support engagement.
            </div>
          ) : (
            paginatedItems.map((item: any) => {
              const clientName = item.participants?.[0]?.participantName || item.participantName || (item.title ? item.title.split('-')?.[1]?.replace(/[\[\]]/g, '').trim() : '1-on-1 Client');
              const platform = item.platform || item.trainingType || 'Cloud Support';
              const engineer = item.trainer || item.engineer || item.assignedToName;
              const clientTotalPaid = item.participants?.reduce((a: number, b: any) => a + (b.amountPaid || 0), 0) || 0;
              const clientTotalDue = item.participants?.reduce((a: number, b: any) => a + (b.amountDue || 0), 0) || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => onEditSession && onEditSession(item)}
                  className="rounded-xl border border-border p-2.5 sm:p-3.5 transition-all hover:border-cyan-500/40 cursor-pointer"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {/* Row 1: Target Platform & Date + Engineer Status (Desktop) & Actions */}
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shrink-0">
                        {platform}
                      </span>
                      <span
                        className="text-[10px] sm:text-xs flex items-center gap-1 shrink-0"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <Clock size={11} className="shrink-0" />
                        {item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (formatRelativeTime(item.messageTimestamp) || 'Flexible')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Engineer badge on desktop only (hidden on mobile to prevent badge overlap) */}
                      {engineer ? (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                          <UserCheck size={11} className="text-indigo-400 shrink-0" />
                          <span className="truncate max-w-[120px]">{engineer}</span>
                        </span>
                      ) : (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0">
                          <User size={11} className="opacity-50 shrink-0" />
                          <span>Unassigned</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAssignModal(item);
                        }}
                        className="px-2 py-0.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1"
                        title="Assign or reassign support engineer"
                      >
                        <UserCheck size={11} />
                        <span>{engineer ? 'Reassign' : 'Assign'}</span>
                      </button>

                      {onEditSession && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSession(item);
                          }}
                          className="p-1 rounded-lg border border-border text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all shrink-0 cursor-pointer"
                          title="Edit Job Support session"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Engagement Title (1:1 with OpsCard single-line height) */}
                  <h4
                    className="font-bold text-xs sm:text-sm mt-1.5 truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.title || `${platform} 1-on-1 Support`}
                  </h4>

                  {/* Row 3: Client, Engineer Info & Location (1:1 with OpsCard Row 3) */}
                  <div
                    className="flex items-center gap-2 sm:gap-3 flex-wrap mt-1 text-[10px] sm:text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <span>
                      Client: <strong className="font-semibold text-cyan-300">{clientName}</strong>
                    </span>
                    <span>
                      Engineer: <strong className="font-semibold text-indigo-300">{engineer || 'Unassigned'}</strong>
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border"
                      style={{ background: 'var(--surface-0)', color: 'var(--text-secondary)' }}
                    >
                      <MapPin size={10} className="shrink-0 text-cyan-400" />
                      <span>{item.location || item.phone || 'Online Sandbox + Teams'}</span>
                    </span>
                  </div>

                  {/* Row 4: Client Financials Bar (Matching OpsCard Fee Status row) */}
                  <div className="pt-2 mt-2 border-t border-border/50 flex items-center justify-between gap-1.5 flex-wrap text-xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      Client Financials
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Paid: <strong className="font-bold font-mono">₹ {clientTotalPaid.toLocaleString()}</strong></span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                        <span>Total Fee: <strong className="font-bold font-mono">₹ {clientTotalDue.toLocaleString()}</strong></span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination Footer (1:1 with Training Operations OpsCard) */}
      {totalPages > 0 && (
        <div
          className="flex flex-col sm:flex-row items-center justify-between border-t border-border/50 mt-3 sm:mt-4 pt-2.5 sm:pt-3 gap-2 text-xs"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <div className="text-[10px] sm:text-[11px]">
            Showing <span className="font-semibold text-cyan-400">{(currentPage - 1) * pageSize + 1}</span>–<span className="font-semibold text-cyan-400">{Math.min(currentPage * pageSize, allItems.length)}</span> of <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{allItems.length}</span> sessions
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-2 transition-all cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
              Page <strong className="font-bold" style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-2 transition-all cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Footer (1:1 with Training Operations OpsCard) */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40 text-xs">
        <span className="text-slate-400 text-[11px]">
          Dedicated 1-on-1 Support Pipeline
        </span>
        <Link
          href="/job-support"
          className="flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 no-underline"
        >
          <span>Full Job Support Ops</span>
          <ChevronRight size={14} />
        </Link>
      </div>

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
