'use client';

import React from 'react';
import { Calendar, Users, PlusCircle, Clock, MapPin, Layers } from 'lucide-react';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface Props {
  opsData: any;
  onOpenModal: () => void;
  loading?: boolean;
}

const platforms = ['Manhattan WMS', 'Blue Yonder', 'Kinaxis', 'SAP S/4HANA'];

export default function OpsCard({ opsData, onOpenModal, loading }: Props) {
  if (loading) return <SkeletonCard />;

  const { summary, sessions = [] } = opsData || {};
  const { platformCounts = {} } = summary || {};

  const statusStyle = (status: string) => {
    switch (status) {
      case 'Completed': return 'badge-completed';
      case 'In Progress': return 'badge-in-progress';
      default: return 'badge-scheduled';
    }
  };

  return (
    <div className="glass-card animate-slide-up">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 text-brand-400 flex items-center justify-center">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Training Operations</h2>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Calendar Sync • Platform Tracking • Session Pipeline</p>
          </div>
        </div>
        <button onClick={onOpenModal} className="btn-secondary !py-1.5 !px-3 !text-xs">
          <PlusCircle size={13} />
          Add Session
        </button>
      </div>

      {/* Platform pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {platforms.map(p => (
          <div key={p} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs" style={{ background: 'var(--surface-2)' }}>
            <Layers size={12} className="text-brand-400" />
            <span style={{ color: 'var(--text-secondary)' }}>{p}:</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{platformCounts[p] || 0}</span>
          </div>
        ))}
      </div>

      {/* Session list */}
      <div className="space-y-3">
        {sessions.map((s: any) => (
          <div key={s.id} className="rounded-xl border border-border p-4 transition-colors hover:border-border-secondary" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${statusStyle(s.status)}`}>{s.platform}</span>
                <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                  <Clock size={11} /> {new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {s.time && `• ${s.time}`}
                </span>
              </div>
              <span className={`badge ${statusStyle(s.status)}`}>{s.status}</span>
            </div>
            <h4 className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{s.title}</h4>
            <div className="flex gap-4 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span>Trainer: <strong style={{ color: 'var(--text-primary)' }}>{s.trainer}</strong></span>
              <span className="flex items-center gap-1"><Users size={11} /> <strong className="text-emerald-400">{s.participantsCount} Enrolled</strong></span>
              {s.location && <span className="flex items-center gap-1"><MapPin size={11} /> {s.location}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
