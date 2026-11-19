'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { expenseDashboardTheme } from '@/config/dashboardTheme';
import { formatCurrency } from '@/lib/utils';

interface LegendItemProps {
  name: string;
  amount: number;
  percentage: number;
  isActive: boolean;
  onHover: (name: string | null) => void;
  onClick: (name: string) => void;
}

export default function LegendItem({
  name,
  amount,
  percentage,
  isActive,
  onHover,
  onClick,
}: LegendItemProps) {
  const categoryConfig =
    (expenseDashboardTheme.colors.categories as Record<string, any>)[name] ||
    expenseDashboardTheme.colors.categories['Other Expenses'];

  return (
    <div
      onMouseEnter={() => onHover(name)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(name)}
      className={`group relative flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-200 cursor-pointer ${
        isActive
          ? 'bg-slate-800/90 border-white/30 shadow-lg shadow-black/40'
          : 'bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-800/60'
      }`}
      style={{
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-3 h-3 rounded-[3px] shrink-0 transition-transform duration-200"
          style={{
            background: `linear-gradient(135deg, ${categoryConfig.solid}, ${categoryConfig.stroke})`,
            boxShadow: `0 0 6px ${categoryConfig.solid}40`,
          }}
        />
        <span
          className="text-xs sm:text-sm font-semibold truncate transition-colors text-slate-200 group-hover:text-white"
        >
          {name}
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-right">
          <div className="text-xs sm:text-sm font-bold font-mono text-slate-100">
            {formatCurrency(amount)}
          </div>
          <div className="text-[10px] font-medium text-slate-400">
            {percentage}% of total
          </div>
        </div>
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 ${
            isActive ? 'translate-x-0.5 text-white' : 'text-slate-500 group-hover:text-slate-300'
          }`}
        />
      </div>
    </div>
  );
}
