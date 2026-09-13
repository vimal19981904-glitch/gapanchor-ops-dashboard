'use client';

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { expenseDashboardTheme } from '@/config/dashboardTheme';
import { formatCurrency } from '@/lib/utils';
import { CategoryData } from '@/hooks/useExpenseData';

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
  const activeData = data.find((d) => d.name === activeCategory);
  const activeConfig = activeData
    ? (expenseDashboardTheme.colors.categories as Record<string, any>)[activeData.name] ||
      expenseDashboardTheme.colors.categories['Other Expenses']
    : null;

  return (
    <div className="relative w-full h-72 sm:h-80 flex items-center justify-center">
      {/* SVG Gradient definitions for chart slices */}
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
          className="absolute top-0 right-0 z-30 p-2.5 sm:p-3 rounded-2xl border shadow-xl backdrop-blur-md animate-fade-in text-xs space-y-0.5 pointer-events-none"
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            borderColor: activeConfig.stroke || 'rgba(148, 163, 184, 0.3)',
          }}
        >
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: activeConfig.solid }} />
            <span className="truncate max-w-[120px]">{activeData.name}</span>
          </div>
          <div className="text-sm font-black font-mono text-white">
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
            stroke="rgba(15, 23, 42, 0.8)"
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
                    filter: isActive ? 'brightness(1.25) drop-shadow(0 0 14px rgba(99, 102, 241, 0.6))' : 'brightness(1.0)',
                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                    transformOrigin: 'center center',
                  }}
                />
              );
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Donut Center Display Overlay (Dynamic & Clean) */}
      <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none z-10">
        <span
          className="text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors duration-200"
          style={{ color: activeConfig ? activeConfig.solid : expenseDashboardTheme.colors.text.muted }}
        >
          {activeData ? activeData.name : centerTitle}
        </span>
        <span className="text-lg sm:text-2xl font-black font-mono text-white mt-0.5 transition-all duration-200">
          {formatCurrency(activeData ? activeData.amount : totalExpense)}
        </span>
        <span className="text-[10px] font-semibold text-emerald-400 mt-0.5">
          {activeData ? `${activeData.percentage}% of total` : `${data.length} Categories`}
        </span>
      </div>
    </div>
  );
}
