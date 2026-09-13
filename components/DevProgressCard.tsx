'use client';

import React from 'react';
import { Code2, GitCommit, PlusCircle, Sparkles, Wrench, Server } from 'lucide-react';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface Props {
  devData: any;
  onOpenModal: () => void;
  loading?: boolean;
}

const typeConfig: Record<string, { label: string; icon: any; badgeClass: string }> = {
  feature: { label: 'Feature', icon: Sparkles, badgeClass: 'badge-completed' },
  fix: { label: 'Fix', icon: Wrench, badgeClass: 'badge-in-progress' },
  infra: { label: 'Infra', icon: Server, badgeClass: 'badge-scheduled' },
};

export default function DevProgressCard({ devData, onOpenModal, loading }: Props) {
  if (loading) return <SkeletonCard />;

  const { updates = [] } = devData || {};

  return (
    <div className="glass-card animate-slide-up !p-3 sm:!p-6 rounded-2xl sm:rounded-3xl">
      <div className="flex items-center justify-between mb-3 sm:mb-5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Code2 size={16} className="sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Dev Progress & Shipped Features</h2>
            <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>Quarterly Timeline • GitHub + Manual Tracking</p>
          </div>
        </div>
        <button onClick={onOpenModal} className="btn-secondary !py-1.5 !px-2.5 sm:!px-3 !text-xs">
          <PlusCircle size={13} />
          <span>Log Feature</span>
        </button>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {updates.map((item: any) => {
          const cfg = typeConfig[item.type] || typeConfig.feature;
          const IconComp = cfg.icon;
          return (
            <div key={item.id} className="rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 transition-colors hover:border-border-secondary" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`badge ${cfg.badgeClass}`}>
                    <IconComp size={11} /> {cfg.label}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{item.quarter}</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</h4>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
              <div className="mt-2 text-[10px] flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                <GitCommit size={11} /> Shipped by: <strong style={{ color: 'var(--text-secondary)' }}>{item.shippedBy}</strong>
                {item.commitSha && <span className="ml-2 font-mono text-brand-400">{item.commitSha}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
