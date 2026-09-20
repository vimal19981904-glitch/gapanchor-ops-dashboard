'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Users,
  PlusCircle,
  Clock,
  MapPin,
  Layers,
  Edit3,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface Props {
  opsData: any;
  onOpenModal: () => void;
  onEditSession?: (session: any) => void;
  loading?: boolean;
}

const platforms = ['Manhattan WMS', 'Blue Yonder', 'Kinaxis', 'SAP S/4HANA'];

export default function OpsCard({ opsData, onOpenModal, onEditSession, loading }: Props) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  if (loading) return <SkeletonCard />;

  const { summary, sessions = [] } = opsData || {};
  const { platformCounts = {}, paymentSummary = {} } = summary || {};

  const totalPages = Math.ceil(sessions.length / pageSize) || 1;
  const paginatedSessions = sessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusStyle = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'badge-completed';
      case 'In Progress':
        return 'badge-in-progress';
      case 'Scheduled':
        return 'badge-scheduled';
      default:
        return 'badge-scheduled';
    }
  };

  return (
    <div className="glass-card animate-slide-up flex flex-col justify-between !p-2.5 sm:!p-6 rounded-2xl sm:rounded-3xl">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-4 pb-2.5 sm:pb-4 border-b border-border/50">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center shrink-0">
              <Calendar size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Training Operations
                </h2>
                <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                  {sessions.length} {sessions.length === 1 ? 'Batch' : 'Batches'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
                SCM Platform Cohorts • Enrollment • Fee Tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              onClick={onOpenModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-500/20 transition-all cursor-pointer shrink-0 flex-1 sm:flex-auto justify-center"
            >
              <PlusCircle size={12} className="sm:w-[13px] sm:h-[13px]" />
              <span>Add Session</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
          {[
            { label: 'Paid', value: paymentSummary.paidCount || 0, sub: 'Completed', color: 'text-emerald-400' },
            { label: 'Partial', value: paymentSummary.partialCount || 0, sub: 'Due Remaining', color: 'text-amber-400' },
            { label: 'Pending', value: paymentSummary.pendingCount || 0, sub: 'Awaiting Fee', color: 'text-rose-400' },
          ].map((m, i) => (
            <div
              key={i}
              className="rounded-lg sm:rounded-xl border border-border p-2 sm:p-3"
              style={{ background: 'var(--surface-2)' }}
            >
              <span className="text-[9px] sm:text-[10px] font-semibold block truncate" style={{ color: 'var(--text-tertiary)' }}>
                {m.label}
              </span>
              <div className={`text-base sm:text-xl font-extrabold mt-0.5 ${m.color}`}>
                {m.value}
              </div>
              <span className="text-[9px] sm:text-[10px] block truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {m.sub}
              </span>
            </div>
          ))}
        </div>

        {/* Platform Overview */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3 sm:mb-4">
          <div className="flex items-center gap-1 p-1 rounded-lg border border-border flex-wrap" style={{ background: 'var(--surface-0)' }}>
            {platforms.map((p) => (
              <span
                key={p}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Layers size={10} className="text-brand-400 shrink-0" />
                <span>{p}:</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{platformCounts[p] || 0}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Session Cohorts List */}
        <div className="space-y-2 sm:space-y-3">
          {sessions.length === 0 ? (
            <div
              className="p-8 text-center text-xs font-medium border border-dashed border-border rounded-xl"
              style={{ color: 'var(--text-tertiary)' }}
            >
              No sessions scheduled yet. Click &quot;Add Session&quot; to add a training session.
            </div>
          ) : (
            paginatedSessions.map((s: any) => {
              const pSummary = s.paymentSummary || { paidCount: 0, partialCount: 0, pendingCount: 0 };

              return (
                <div
                  key={s.id}
                  onClick={() => onEditSession && onEditSession(s)}
                  className="rounded-xl border border-border p-2.5 sm:p-3.5 transition-all hover:border-border-secondary cursor-pointer"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {/* Row 1: Platform & Time + Status & Edit */}
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
                        {s.platform}
                      </span>
                      <span
                        className="text-[10px] sm:text-xs flex items-center gap-1 shrink-0"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <Clock size={11} className="shrink-0" />
                        {new Date(s.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                        {s.time && ` • ${s.time}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`badge !text-[10px] !py-0.5 !px-2 ${statusStyle(s.status)}`}>
                        {s.status}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditSession) onEditSession(s);
                        }}
                        className="p-1 rounded-lg border border-border text-tertiary hover:text-brand-400 hover:border-brand-500/40 hover:bg-brand-500/10 transition-all shrink-0 cursor-pointer"
                        title="Edit session"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Title */}
                  <h4
                    className="font-bold text-xs sm:text-sm mt-1.5 truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {s.title}
                  </h4>

                  {/* Row 3: Trainer & Participants & Location */}
                  <div
                    className="flex items-center gap-2 sm:gap-3 flex-wrap mt-1 text-[10px] sm:text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <span>
                      Trainer: <strong className="font-semibold text-brand-400">{s.trainer}</strong>
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border"
                      style={{ background: 'var(--surface-0)', color: 'var(--text-secondary)' }}
                    >
                      <Users size={10} className="shrink-0 text-brand-400" />
                      <span><strong style={{ color: 'var(--text-primary)' }}>{s.participantsCount}</strong> Enrolled</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border"
                      style={{ background: 'var(--surface-0)', color: 'var(--text-secondary)' }}
                    >
                      <GraduationCap size={10} className="shrink-0 text-emerald-400" />
                      <span><strong style={{ color: 'var(--text-primary)' }}>{s.currentlyParticipating || s.participantsCount}</strong> Active</span>
                    </span>
                    {s.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={10} className="shrink-0 opacity-70" /> {s.location}
                      </span>
                    )}
                  </div>

                  {/* Row 4: Fee Status Row */}
                  <div className="pt-2 mt-2 border-t border-border/50 flex items-center justify-between gap-1.5 flex-wrap text-xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      Fee Status
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Paid: <strong className="font-bold">{pSummary.paidCount}</strong></span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/20 bg-amber-500/10 text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Partial: <strong className="font-bold">{pSummary.partialCount}</strong></span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/20 bg-rose-500/10 text-rose-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>Pending: <strong className="font-bold">{pSummary.pendingCount}</strong></span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div
          className="flex flex-col sm:flex-row items-center justify-between border-t border-border/50 mt-3 sm:mt-4 pt-2.5 sm:pt-3 gap-2 text-xs"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <div className="text-[10px] sm:text-[11px]">
            Showing <span className="font-semibold text-brand-400">{(currentPage - 1) * pageSize + 1}</span>–<span className="font-semibold text-brand-400">{Math.min(currentPage * pageSize, sessions.length)}</span> of <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{sessions.length}</span> sessions
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
    </div>
  );
}
