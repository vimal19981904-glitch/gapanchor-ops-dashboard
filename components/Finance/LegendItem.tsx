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
      className={`group relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
        isActive ? 'scale-[1.02] shadow-lg shadow-black/40 border-cyan-500/50' : 'hover:scale-[1.01]'
      }`}
      style={{
        background: isActive
          ? categoryConfig.bgAlpha || 'rgba(30, 41, 59, 0.95)'
          : expenseDashboardTheme.colors.surfaces.cardBg,
        borderColor: isActive
          ? categoryConfig.stroke
          : expenseDashboardTheme.colors.surfaces.borderDefault,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-3.5 h-3.5 rounded-[4px] shrink-0 transition-transform duration-300 group-hover:scale-125"
          style={{
            background: `linear-gradient(135deg, ${categoryConfig.solid}, ${categoryConfig.stroke})`,
            boxShadow: `0 0 10px ${categoryConfig.solid}66`,
          }}
        />
        <span
          className="text-xs sm:text-sm font-semibold truncate transition-colors group-hover:text-white"
          style={{ color: isActive ? '#ffffff' : expenseDashboardTheme.colors.text.primary }}
        >
          {name}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div
            className="text-xs sm:text-sm font-bold font-mono"
            style={{ color: isActive ? '#ffffff' : expenseDashboardTheme.colors.text.primary }}
          >
            {formatCurrency(amount)}
          </div>
          <div
            className="text-[10px] font-semibold"
            style={{ color: expenseDashboardTheme.colors.text.secondary }}
          >
            {percentage}% of total
          </div>
        </div>
        <ChevronRight
          size={14}
          className={`transition-transform duration-300 ${
            isActive ? 'translate-x-0.5 text-white' : 'text-slate-500 group-hover:text-slate-300'
          }`}
        />
      </div>
    </div>
  );
}
