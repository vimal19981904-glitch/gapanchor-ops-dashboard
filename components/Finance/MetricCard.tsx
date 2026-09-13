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
}

export default function MetricCard({ label, value, subtext, icon: Icon, badge, badgeType = 'emerald' }: MetricCardProps) {
  const badgeStyles = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  };

  return (
    <div
      className="group relative rounded-2xl p-3 sm:p-4 transition-all duration-300 hover:-translate-y-0.5 border"
      style={{
        background: expenseDashboardTheme.colors.surfaces.cardBg,
        borderColor: expenseDashboardTheme.colors.surfaces.borderDefault,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
        <span
          className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate"
          style={{ color: expenseDashboardTheme.colors.text.muted }}
        >
          {label}
        </span>
        {Icon && (
          <div className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-slate-800/60 text-slate-400 group-hover:text-white transition-colors shrink-0">
            <Icon size={13} className="sm:w-3.5 sm:h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
        <span
          className="text-sm sm:text-xl font-extrabold tracking-tight font-mono truncate"
          style={{ color: expenseDashboardTheme.colors.text.primary }}
        >
          {value}
        </span>
        {badge && (
          <span className={`px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-extrabold rounded-full border shrink-0 ${badgeStyles[badgeType]}`}>
            {badge}
          </span>
        )}
      </div>

      {subtext && (
        <p
          className="text-[11px] mt-1 font-medium truncate"
          style={{ color: expenseDashboardTheme.colors.text.secondary }}
        >
          {subtext}
        </p>
      )}
    </div>
  );
}
