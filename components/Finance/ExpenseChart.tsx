'use client';

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { expenseDashboardTheme } from '@/config/dashboardTheme';
import { formatCurrency } from '@/lib/utils';
import { CategoryData } from '@/hooks/useExpenseData';
import { Loader2 } from 'lucide-react';

interface ExpenseChartProps {
  data: CategoryData[];
  totalExpense: number;
  activeCategory: string | null;
  onHoverCategory: (name: string | null) => void;
  onSelectCategory: (name: string) => void;
  centerTitle?: string;
}

export default function ExpenseChart({
  data,
  totalExpense,
  activeCategory,
  onHoverCategory,
  onSelectCategory,
  centerTitle = 'Total Expense',
}: ExpenseChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="relative w-full h-64 sm:h-72 flex flex-col items-center justify-center space-y-3">
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full border-4 border-slate-800 border-t-slate-500 animate-spin flex items-center justify-center">
          <div className="w-28 h-28 rounded-full border-2 border-slate-800 border-b-slate-400 animate-pulse flex flex-col items-center justify-center text-center p-2">
            <Loader2 size={20} className="text-slate-400 animate-spin mb-1" />
            <span className="text-[10px] font-bold text-slate-400">Loading...</span>
          </div>
        </div>
        <p className="text-xs font-bold text-slate-300 animate-pulse">Calculating {centerTitle} Breakdown...</p>
      </div>
    );
  }

  const activeData = data.find((d) => d.name === activeCategory);
  const activeConfig = activeData
    ? (expenseDashboardTheme.colors.categories as Record<string, any>)[activeData.name] ||
      expenseDashboardTheme.colors.categories['Other Expenses']
    : null;

  return (
    <div className="relative w-full h-64 sm:h-72 flex items-center justify-center animate-fade-in">
      {/* SVG Gradient definitions for monochrome chart slices */}
      <svg className="absolute w-0 h-0 overflow-hidden">
        <defs>
          {Object.entries(expenseDashboardTheme.colors.categories).map(([key, config]) => (
            <linearGradient key={key} id={`grad-${key.replace(/[^a-zA-Z0-9]/g, '-')}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={config.solid} />
              <stop offset="100%" stopColor={config.stroke} />
            </linearGradient>
          ))}
        </defs>
      </svg>

      {/* Top-Right Background Space Hover Badge (Zero Center Overlap) */}
      {activeData && activeConfig && (
        <div
          className="absolute top-0 right-0 z-30 p-2 sm:p-2.5 rounded-xl border shadow-xl backdrop-blur-md animate-fade-in text-xs space-y-0.5 pointer-events-none"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activeConfig.solid }} />
            <span className="truncate max-w-[120px]">{activeData.name}</span>
          </div>
          <div className="text-xs font-bold font-mono text-white">
            {formatCurrency(activeData.amount)}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold">
            {activeData.percentage}% of total ({activeData.count || 1} items)
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={expenseDashboardTheme.chart.innerRadius}
            outerRadius={expenseDashboardTheme.chart.outerRadius}
            paddingAngle={expenseDashboardTheme.chart.paddingAngle}
            dataKey="amount"
            stroke="rgba(15, 23, 42, 0.9)"
            strokeWidth={4}
            cornerRadius={6}
            onMouseEnter={(_, index) => onHoverCategory(data[index]?.name || null)}
            onMouseLeave={() => onHoverCategory(null)}
            onClick={(_, index) => onSelectCategory(data[index]?.name)}
          >
            {data.map((entry) => {
              const isActive = activeCategory === entry.name;
              const gradId = `grad-${entry.name.replace(/[^a-zA-Z0-9]/g, '-')}`;

              return (
                <Cell
                  key={entry.name}
                  fill={`url(#${gradId})`}
                  className="transition-all duration-300 cursor-pointer outline-none"
                  style={{
                    filter: isActive ? 'brightness(1.3) drop-shadow(0 0 10px rgba(255, 255, 255, 0.35))' : 'brightness(1.0)',
                    transform: isActive ? 'scale(1.03)' : 'scale(1)',
                    transformOrigin: 'center center',
                  }}
                />
              );
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Donut Center Display Overlay (Dynamic, Minimal & Refined) */}
      <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none z-10">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors duration-200">
          {activeData ? activeData.name : centerTitle}
        </span>
        <span className="text-base sm:text-xl font-bold font-mono text-white mt-0.5 transition-all duration-200">
          {formatCurrency(activeData ? activeData.amount : totalExpense)}
        </span>
        <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
          {activeData ? `${activeData.percentage}% of total` : `${data.length} Categories`}
        </span>
      </div>
    </div>
  );
}
