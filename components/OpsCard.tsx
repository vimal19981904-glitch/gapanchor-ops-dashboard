'use client';

import React from 'react';
import { Calendar, Users, PlusCircle, Clock, MapPin, Layers, Edit3, GraduationCap, DollarSign } from 'lucide-react';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface Props {
  opsData: any;
  onOpenModal: () => void;
  onEditSession?: (session: any) => void;
  loading?: boolean;
}

const platforms = ['Manhattan WMS', 'Blue Yonder', 'Kinaxis', 'SAP S/4HANA'];

export default function OpsCard({ opsData, onOpenModal, onEditSession, loading }: Props) {
  if (loading) return <SkeletonCard />;

  const { summary, sessions = [] } = opsData || {};
  const { platformCounts = {}, paymentSummary = {} } = summary || {};

  const statusStyle = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'badge-completed';
      case 'In Progress':
        return 'badge-in-progress';
      default:
        return 'badge-scheduled';
    }
  };

  return (
    <div className="glass-card animate-slide-up !p-3 sm:!p-6 rounded-2xl sm:rounded-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-3 sm:mb-5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Calendar size={16} className="sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Training and Finance Tracking
              </h2>
              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Payment Persistence Active
              </span>
            </div>
            <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Participant Enrollment • Payment Status Tracking • Database Persistence
            </p>
          </div>
        </div>

        <button
          onClick={onOpenModal}
          className="btn-primary !py-1.5 sm:!py-2 !px-3 sm:!px-3.5 !text-xs self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle size={13} className="sm:w-3.5 sm:h-3.5" />
          <span>Add Session</span>
        </button>
      </div>

      {/* Grand Payment Status Summary Bar */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-3 sm:mb-5 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-border/80 bg-surface-2">
        <div className="text-center p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[10px] sm:text-xs font-bold text-emerald-400 block truncate">
            <span className="status-dot status-dot-paid" /> Paid
          </span>
          <span className="text-sm sm:text-xl font-black text-emerald-300">
            {paymentSummary.paidCount || 0}
          </span>
        </div>

        <div className="text-center p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-[10px] sm:text-xs font-bold text-amber-400 block truncate">
            <span className="status-dot status-dot-partial" /> Partial
          </span>
          <span className="text-sm sm:text-xl font-black text-amber-300">
            {paymentSummary.partialCount || 0}
          </span>
        </div>

        <div className="text-center p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-rose-500/10 border border-rose-500/20">
          <span className="text-[10px] sm:text-xs font-bold text-rose-400 block truncate">
            <span className="status-dot status-dot-pending" /> Pending
          </span>
          <span className="text-sm sm:text-xl font-black text-rose-300">
            {paymentSummary.pendingCount || 0}
          </span>
        </div>
      </div>

      {/* Platform Pills */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-5">
        {platforms.map((p) => (
          <div
            key={p}
            className="flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border border-border px-2 sm:px-3 py-0.5 sm:py-1 text-[11px] sm:text-xs"
            style={{ background: 'var(--surface-2)' }}
          >
            <Layers size={11} className="text-cyan-400 sm:w-3 sm:h-3" />
            <span style={{ color: 'var(--text-secondary)' }}>{p}:</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {platformCounts[p] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Session Cards List */}
      <div className="space-y-2 sm:space-y-3">
        {sessions.length === 0 ? (
          <div
            className="p-6 sm:p-8 text-center text-xs font-semibold rounded-2xl border border-dashed border-border"
            style={{ color: 'var(--text-tertiary)' }}
          >
            No sessions scheduled yet. Click "Add Session" to add a training session.
          </div>
        ) : (
          sessions.map((s: any) => {
            const pSummary = s.paymentSummary || { paidCount: 0, partialCount: 0, pendingCount: 0 };

            return (
              <div
                key={s.id}
                onClick={() => onEditSession && onEditSession(s)}
                className="group relative rounded-xl sm:rounded-2xl border border-border/80 p-3 sm:p-4 transition-all duration-200 hover:border-cyan-500/40 hover:shadow-lg cursor-pointer"
                style={{ background: 'var(--surface-2)' }}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`badge ${statusStyle(s.status)}`}>{s.platform}</span>
                    <span
                      className="text-[11px] flex items-center gap-1 font-medium truncate"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Clock size={11} className="shrink-0" />
                      <span>
                        {new Date(s.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                        {s.time && ` • ${s.time}`}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge ${statusStyle(s.status)}`}>{s.status}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditSession) onEditSession(s);
                      }}
                      className="p-1 rounded-lg border border-border hover:bg-surface-3 hover:text-cyan-300 transition-colors cursor-pointer"
                      title="Edit session & payment details"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                </div>

                {/* Session Title */}
                <h4
                  className="text-sm sm:text-base font-bold mb-2 group-hover:text-cyan-400 transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {s.title}
                </h4>

                {/* Details Row */}
                <div
                  className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-3 font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span>
                    Trainer:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{s.trainer}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} className="text-cyan-400 shrink-0" />
                    <strong className="text-cyan-300">{s.participantsCount} Enrolled</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <GraduationCap size={12} className="text-emerald-400 shrink-0" />
                    <strong className="text-emerald-300">
                      {s.currentlyParticipating || s.participantsCount} Currently
                    </strong>
                  </span>
                  {s.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="shrink-0" /> {s.location}
                    </span>
                  )}
                </div>

                {/* Requirement 2: Payment Summary Row */}
                <div className="flex items-center gap-3 pt-2.5 border-t border-border/40 text-[11px] font-bold">
                  <span className="text-tertiary font-semibold text-[10px]">Payment Status:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="status-dot status-dot-paid" /> Paid: {pSummary.paidCount}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <span className="status-dot status-dot-partial" /> Partial: {pSummary.partialCount}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <span className="status-dot status-dot-pending" /> Pending: {pSummary.pendingCount}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
