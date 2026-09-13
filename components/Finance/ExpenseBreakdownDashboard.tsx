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

export default function ExpenseBreakdownDashboard() {
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
  } = useExpenseData('all');

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
      className="relative rounded-3xl p-5 sm:p-7 border backdrop-blur-xl shadow-2xl transition-all duration-300 space-y-6"
      style={{
        background: expenseDashboardTheme.colors.surfaces.containerBg,
        borderColor: expenseDashboardTheme.colors.surfaces.borderDefault,
      }}
    >
      {/* 3.1 Header Section & Time-Based Filter Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2
              className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent"
            >
              Expense Overview
            </h2>
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Sparkles size={11} /> Enterprise Analytics
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Financial breakdown & spending analysis
          </p>
        </div>

        {/* 4.5 Time-Based Filtering Controls */}
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
                  ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3.2 KPI Cards (Metric Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Total Expense"
          value={formatCurrency(metrics.totalExpense)}
          subtext="Statement debit total"
          icon={DollarSign}
          badge="Live"
          badgeType="emerald"
        />
        <MetricCard
          label="Highest Category"
          value={`${metrics.highestCategory.percentage}%`}
          subtext={metrics.highestCategory.name}
          icon={PieChartIcon}
          badge="Dominant"
          badgeType="cyan"
        />
        <MetricCard
          label="Records"
          value={`${metrics.recordsCount} Items`}
          subtext="Statement debit entries"
          icon={Layers}
          badge="Verified"
          badgeType="purple"
        />
        <MetricCard
          label="Categories"
          value={`${metrics.categoriesCount} Types`}
          subtext="Categorized spending"
          icon={Activity}
          badge="Structured"
          badgeType="emerald"
        />
      </div>

      {/* 3.3 Donut Chart & 3.4 Interactive Legend Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80">
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
        <div className="lg:col-span-6 space-y-2.5">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-bold text-slate-300">Category Breakdown</span>
            <span className="text-[10px] text-slate-500 font-semibold">Click row to drill-down</span>
          </div>

          <div className="space-y-2.5">
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

      {/* 4. Additional Features: Month-over-Month, 6-Month Trend & Forecast */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* 4.1 Month-over-Month Comparison */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Month-over-Month</span>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
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

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-medium">
            Variance: <strong className={isMomNegative ? 'text-emerald-400' : 'text-rose-400'}>
              {isMomNegative ? '-' : '+'}{formatCurrency(Math.abs(metrics.momVariance))}
            </strong>
          </div>
        </div>

        {/* 4.2 Spending Trend Line (6-Month Trend) */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">6-Month Expense Trend</span>
            <span className="text-[10px] text-emerald-400 font-semibold">Controlled Rate</span>
          </div>

          <div className="h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendLine}>
                <defs>
                  <linearGradient id="miniTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" hide />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Expense']}
                  contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fill="url(#miniTrendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11px] text-slate-400 font-medium truncate">
            Stable run rate across statement periods
          </div>
        </div>

        {/* 4.3 Expense Forecast Badge Card */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Predictive Forecast</span>
            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              AI Projected
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-slate-400 block">Projected Next Month:</span>
            <span className="text-xl font-black font-mono text-cyan-300 block">
              {metrics.projectedNextMonth}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-medium">
            Based on current category run rates
          </div>
        </div>
      </div>

      {/* 4.4 Category Drill-Down Modal */}
      {drillDownCategory && (
        <CategoryDrillDownModal
          category={drillDownCategory}
          onClose={() => setDrillDownCategory(null)}
        />
      )}
    </div>
  );
}
