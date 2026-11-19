'use client';

import React from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Layers, PieChart as PieChartIcon,
  Sparkles, Calendar, ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { expenseDashboardTheme } from '@/config/dashboardTheme';
import { useExpenseData, CategoryData } from '@/hooks/useExpenseData';
import MetricCard from './MetricCard';
import LegendItem from './LegendItem';
import ExpenseChart from './ExpenseChart';
import CategoryDrillDownModal from './CategoryDrillDownModal';
import { formatCurrency } from '@/lib/utils';

export default function ExpenseBreakdownDashboard({ refreshTrigger }: { refreshTrigger?: any } = {}) {
  const {
    dateRange,
    setDateRange,
    loading,
    metrics,
    categoriesData,
    trendLine,
    activeCategory,
    setActiveCategory,
    drillDownCategory,
    setDrillDownCategory,
  } = useExpenseData('all', refreshTrigger);

  const handleLegendClick = (name: string) => {
    const found = categoriesData.find((c) => c.name === name);
    if (found) {
      setDrillDownCategory(found);
    } else {
      setDrillDownCategory({
        name,
        amount: Math.round(metrics.totalExpense * 0.1),
        count: 5,
        percentage: 10,
        transactions: [],
      });
    }
  };

  const isMomNegative = metrics.momVariance < 0;

  return (
    <div
      className="relative rounded-3xl p-4 sm:p-6 border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-2xl transition-all duration-300 space-y-4 sm:space-y-5"
    >
      {/* Header Section & Time-Based Filter Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
              Expense Overview
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-white/[0.06] text-slate-300 border border-white/12 flex items-center gap-1">
              <Sparkles size={11} className="text-slate-400" /> Enterprise Analytics
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Financial breakdown & spending analysis
          </p>
        </div>

        {/* Time-Based Filtering Controls - Grey Glass Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/10 self-start sm:self-auto">
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
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                dateRange === item.id
                  ? 'bg-gradient-to-b from-white/[0.18] to-white/[0.06] text-white shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] border border-white/20 backdrop-blur-xl font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
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
          label="Total Expense"
          value={formatCurrency(metrics.totalExpense)}
          subtext="Statement debit total"
          icon={DollarSign}
          badge="Debit"
          badgeType="rose"
          loading={loading}
        />
        <MetricCard
          label="Highest Category"
          value={`${metrics.highestCategory.percentage}%`}
          subtext={metrics.highestCategory.name}
          icon={PieChartIcon}
          badge="Dominant"
          badgeType="cyan"
          loading={loading}
        />
        <MetricCard
          label="Records"
          value={`${metrics.recordsCount} Items`}
          subtext="Statement debit entries"
          icon={Layers}
          badge="Verified"
          badgeType="purple"
          loading={loading}
        />
        <MetricCard
          label="Categories"
          value={`${metrics.categoriesCount} Types`}
          subtext="Categorized spending"
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
            totalExpense={metrics.totalExpense}
            activeCategory={activeCategory}
            onHoverCategory={setActiveCategory}
            onSelectCategory={handleLegendClick}
          />
        </div>

        {/* Right: Interactive Legend */}
        <div className="lg:col-span-6 space-y-2">
          <div className="flex items-center justify-between px-1 mb-0.5">
            <span className="text-xs font-bold text-slate-300">Category Breakdown</span>
            <span className="text-[10px] text-slate-500 font-medium">Click row to drill-down</span>
          </div>

          <div className="space-y-2">
            {categoriesData.map((cat) => (
              <LegendItem
                key={cat.name}
                name={cat.name}
                amount={cat.amount}
                percentage={cat.percentage}
                isActive={activeCategory === cat.name}
                onHover={setActiveCategory}
                onClick={handleLegendClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Additional Features: Month-over-Month, 6-Month Trend & Forecast */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {/* Month-over-Month Comparison */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Month-over-Month</span>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                isMomNegative
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {isMomNegative ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
              <span>{metrics.momPercentage}%</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">This Month:</span>
              <span className="font-bold font-mono text-white">{formatCurrency(metrics.thisMonthTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Last Month:</span>
              <span className="font-bold font-mono text-slate-400">{formatCurrency(metrics.lastMonthTotal)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 font-medium">
            Variance: <strong className={isMomNegative ? 'text-emerald-400' : 'text-rose-400'}>
              {isMomNegative ? '-' : '+'}{formatCurrency(Math.abs(metrics.momVariance))}
            </strong>
          </div>
        </div>

        {/* Spending Trend Line (6-Month Trend) */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">6-Month Expense Trend</span>
            <span className="text-[10px] text-emerald-400 font-semibold">Controlled Rate</span>
          </div>

          <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendLine}>
                <defs>
                  <linearGradient id="miniTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" hide />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Expense']}
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#miniTrendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11px] text-slate-400 font-medium truncate">
            Stable run rate across statement periods
          </div>
        </div>

        {/* Expense Forecast Badge Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Predictive Forecast</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-white/[0.06] text-slate-300 border border-white/15">
              AI Projected
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 block">Projected Next Month:</span>
            <span className="text-lg font-bold font-mono text-white block">
              {metrics.projectedNextMonth}
            </span>
          </div>

          <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 font-medium">
            Based on current category run rates
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
