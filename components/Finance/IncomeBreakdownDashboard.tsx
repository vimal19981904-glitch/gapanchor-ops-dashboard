'use client';

import React from 'react';
import {
  TrendingUp, Layers, PieChart as PieChartIcon,
  Sparkles, Activity, DollarSign
} from 'lucide-react';
import { expenseDashboardTheme } from '@/config/dashboardTheme';
import { useIncomeData } from '@/hooks/useIncomeData';
import { CategoryData } from '@/hooks/useExpenseData';
import MetricCard from './MetricCard';
import LegendItem from './LegendItem';
import ExpenseChart from './ExpenseChart';
import CategoryDrillDownModal from './CategoryDrillDownModal';
import { formatCurrency } from '@/lib/utils';

export default function IncomeBreakdownDashboard() {
  const {
    dateRange,
    setDateRange,
    loading,
    metrics,
    categoriesData,
    activeCategory,
    setActiveCategory,
    drillDownCategory,
    setDrillDownCategory,
  } = useIncomeData('all');

  const handleLegendClick = (name: string) => {
    const found = categoriesData.find((c) => c.name === name);
    if (found) {
      setDrillDownCategory(found);
    } else {
      setDrillDownCategory({
        name,
        amount: Math.round(metrics.totalIncome * 0.1),
        count: 4,
        percentage: 10,
        transactions: [],
      });
    }
  };

  return (
    <div
      className="relative rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 backdrop-blur-xl shadow-sm dark:shadow-2xl transition-all duration-300 space-y-4 sm:space-y-5"
    >
      {/* Header Section & Time-Based Filter Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Income Overview & Money Flow
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/12 flex items-center gap-1">
              <Sparkles size={11} className="text-emerald-500 dark:text-slate-400" /> Revenue Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Financial revenue breakdown & income streams analysis
          </p>
        </div>

        {/* Time-Based Filtering Controls - Grey Glass Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 self-start sm:self-auto">
          {[
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
            { id: 'quarter', label: 'Quarter' },
            { id: 'year', label: 'Year' },
            { id: 'all', label: 'All Time' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setDateRange(item.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${dateRange === item.id
                ? 'bg-blue-600 dark:bg-gradient-to-b dark:from-white/[0.18] dark:to-white/[0.06] text-white shadow-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] border border-blue-600 dark:border-white/20 backdrop-blur-xl font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.04]'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards (Metric Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <MetricCard
          label="Total Income"
          value={formatCurrency(metrics.totalIncome)}
          subtext="Statement credit total"
          icon={DollarSign}
          badge="Credit"
          badgeType="emerald"
          loading={loading}
        />
        <MetricCard
          label="Top Revenue Source"
          value={`${metrics.highestCategory.percentage}%`}
          subtext={metrics.highestCategory.name}
          icon={PieChartIcon}
          badge="Dominant"
          badgeType="cyan"
          loading={loading}
        />
        <MetricCard
          label="Credit Entries"
          value={`${metrics.recordsCount} Items`}
          subtext="Statement credit records"
          icon={Layers}
          badge="Verified"
          badgeType="purple"
          loading={loading}
        />
        <MetricCard
          label="Revenue Streams"
          value={`${metrics.categoriesCount} Channels`}
          subtext="Income categorization"
          icon={Activity}
          badge="Structured"
          badgeType="cyan"
          loading={loading}
        />
      </div>

      {/* Donut Chart & Interactive Legend Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/40 border border-white/10">
        {/* Left: Doughnut Chart */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <ExpenseChart
            data={categoriesData}
            totalExpense={metrics.totalIncome}
            activeCategory={activeCategory}
            onHoverCategory={setActiveCategory}
            onSelectCategory={handleLegendClick}
            centerTitle="Total Income"
          />
        </div>

        {/* Right: Interactive Legend */}
        <div className="lg:col-span-6 space-y-2">
          <div className="flex items-center justify-between px-1 mb-0.5">
            <span className="text-xs font-bold text-slate-300">Revenue Source Breakdown</span>
            <span className="text-[10px] text-slate-500 font-medium">Click row to drill-down</span>
          </div>

          <div className="space-y-2">
            {categoriesData.map((category) => (
              <LegendItem
                key={category.name}
                name={category.name}
                amount={category.amount}
                percentage={category.percentage}
                isActive={activeCategory === category.name}
                onHover={setActiveCategory}
                onClick={handleLegendClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Category Drill-Down Modal */}
      {drillDownCategory && (
        <CategoryDrillDownModal
          category={drillDownCategory}
          onClose={() => setDrillDownCategory(null)}
        />
      )}
    </div>
  );
}
