'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  value: string;
  subtext: string;
  icon: LucideIcon;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan';
}

const colorStyles = {
  indigo: { iconBg: 'bg-brand-500/15 border-brand-500/30', iconText: 'text-brand-400' },
  emerald: { iconBg: 'bg-emerald-500/15 border-emerald-500/30', iconText: 'text-emerald-400' },
  amber: { iconBg: 'bg-amber-500/15 border-amber-500/30', iconText: 'text-amber-400' },
  rose: { iconBg: 'bg-rose-500/15 border-rose-500/30', iconText: 'text-rose-400' },
  cyan: { iconBg: 'bg-cyan-500/15 border-cyan-500/30', iconText: 'text-cyan-400' },
};

export default function StatCard({ title, value, subtext, icon: Icon, trend, trendValue, color = 'indigo' }: Props) {
  const cs = colorStyles[color];

  return (
    <div className="glass-card animate-slide-up" style={{ padding: '20px' }}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {title}
          </span>
          <div className="text-2xl font-extrabold mt-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {value}
          </div>
        </div>
        <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center', cs.iconBg, cs.iconText)}>
          <Icon size={20} />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--text-secondary)' }}>{subtext}</span>
        {trend && (
          <span className={cn(
            'inline-flex items-center gap-0.5 font-bold rounded-full px-2 py-0.5',
            trend === 'up' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
          )}>
            {trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
