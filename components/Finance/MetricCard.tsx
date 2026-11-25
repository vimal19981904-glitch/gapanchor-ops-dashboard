'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { expenseDashboardTheme } from '@/config/dashboardTheme';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  badge?: string;
  badgeType?: 'emerald' | 'rose' | 'cyan' | 'purple';
  loading?: boolean;
}

export default function MetricCard({ label, value, subtext, icon: Icon, badge, badgeType = 'emerald', loading }: MetricCardProps) {
  const badgeStyles = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    cyan: 'bg-white/[0.06] text-slate-300 border border-white/15',
    purple: 'bg-white/[0.06] text-slate-300 border border-white/15',
  };

  return (
    <div
      className="group relative rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 transition-all duration-200 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-white/20 shadow-sm dark:shadow-none"
      style={{
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate"
        >
          {label}
        </span>
        {Icon && (
          <div className="p-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors shrink-0">
            <Icon size={13} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-1.5 my-1">
          <div className="h-5 sm:h-6 w-20 sm:w-24 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
            <span
              className="text-xs sm:text-lg font-bold tracking-tight font-mono text-slate-900 dark:text-white truncate"
            >
              {value}
            </span>
            {badge && (
              <span className={`px-1.5 py-0.2 text-[8.5px] sm:text-[9.5px] font-semibold rounded-full border shrink-0 ${badgeStyles[badgeType]}`}>
                {badge}
              </span>
            )}
          </div>

          {subtext && (
            <p
              className="text-[10.5px] mt-0.5 font-medium text-slate-500 dark:text-slate-400 truncate"
            >
              {subtext}
            </p>
          )}
        </>
      )}
    </div>
  );
}
