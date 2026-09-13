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
    <div className="glass-card animate-slide-up !p-2.5 sm:!p-5 rounded-2xl sm:rounded-3xl flex flex-col justify-between">
      <div className="flex justify-between items-start mb-1.5 sm:mb-3 gap-1">
        <div className="min-w-0 pr-1">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider block truncate" style={{ color: 'var(--text-tertiary)' }}>
            {title}
          </span>
          <div className="text-base sm:text-2xl font-extrabold mt-0.5 sm:mt-1 tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
            {value}
          </div>
        </div>
        <div className={cn('w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border flex items-center justify-center shrink-0', cs.iconBg, cs.iconText)}>
          <Icon size={14} className="sm:w-5 sm:h-5" />
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] sm:text-xs gap-1">
        <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{subtext}</span>
        {trend && (
          <span className={cn(
            'inline-flex items-center gap-0.5 font-bold rounded-full px-1.5 py-0.5 sm:px-2 shrink-0 text-[9px] sm:text-[11px]',
            trend === 'up' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
          )}>
            {trend === 'up' ? <ArrowUpRight size={10} className="sm:w-[13px] sm:h-[13px]" /> : <ArrowDownRight size={10} className="sm:w-[13px] sm:h-[13px]" />}
            <span>{trendValue}</span>
          </span>
        )}
      </div>
    </div>
  );
}
