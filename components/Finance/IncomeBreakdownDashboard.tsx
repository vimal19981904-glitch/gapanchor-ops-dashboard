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
      className="relative rounded-3xl p-5 sm:p-7 border backdrop-blur-xl shadow-2xl transition-all duration-300 space-y-6"
      style={{
        background: expenseDashboardTheme.colors.surfaces.containerBg,
        borderColor: 'rgba(148, 163, 184, 0.25)',
      }}
    >
      {/* Header Section & Time-Based Filter Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-slate-300 to-slate-400 bg-clip-text text-transparent">
              Income Overview & Money Flow
            </h2>
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1">
              <Sparkles size={11} className="text-slate-400" /> Revenue Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Financial revenue breakdown & income streams analysis
          </p>
        </div>

        {/* Time-Based Filtering Controls */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-slate-800 self-start sm:self-auto">
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
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                dateRange === item.id
                  ? 'bg-slate-700 text-white shadow-md border border-slate-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards (Metric Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Total Income"
          value={formatCurrency(metrics.totalIncome)}
          subtext="Statement credit total"
          icon={DollarSign}
          badge="Credit"
          badgeType="emerald"
        />
        <MetricCard
          label="Top Revenue Source"
          value={`${metrics.highestCategory.percentage}%`}
          subtext={metrics.highestCategory.name}
          icon={PieChartIcon}
          badge="Dominant"
          badgeType="cyan"
        />
        <MetricCard
          label="Credit Entries"
          value={`${metrics.recordsCount} Items`}
          subtext="Statement credit records"
          icon={Layers}
          badge="Verified"
          badgeType="purple"
        />
        <MetricCard
          label="Revenue Streams"
          value={`${metrics.categoriesCount} Channels`}
          subtext="Income categorization"
          icon={Activity}
          badge="Structured"
          badgeType="emerald"
        />
      </div>

      {/* Donut Chart & Interactive Legend Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80">
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
        <div className="lg:col-span-6 space-y-2.5">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-bold text-slate-300">Revenue Source Breakdown</span>
            <span className="text-[10px] text-slate-500 font-medium">Click row to drill-down</span>
          </div>

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
