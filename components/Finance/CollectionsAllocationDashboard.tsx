'use client';

import React, { useState, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Layers, PieChart as PieChartIcon,
  Sparkles, AlertCircle, ShieldAlert, CheckCircle2, Info, ArrowRight,
  Wallet, Receipt, Users, PlusCircle, HelpCircle, AlertTriangle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { expenseDashboardTheme } from '@/config/dashboardTheme';
import { formatCurrency } from '@/lib/utils';
import LegendItem from './LegendItem';
import MetricCard from './MetricCard';

interface CollectionsAllocationProps {
  totalIncome?: number;
  totalExpense?: number;
  onOpenAddModal?: () => void;
}

export default function CollectionsAllocationDashboard({
  totalIncome = 896435.60,
  totalExpense = 596482.96,
  onOpenAddModal
}: CollectionsAllocationProps) {
  const [dateRange, setDateRange] = useState<string>('all');
  const [trainerPercentage, setTrainerPercentage] = useState<number>(50); // Default 50%
  const [trainerPaidRatio, setTrainerPaidRatio] = useState<number>(50); // 50% of trainer cost paid so far
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Time-range multiplier simulation
  const timeMultiplier = useMemo(() => {
    switch (dateRange) {
      case 'week': return 0.15;
      case 'month': return 0.35;
      case 'quarter': return 0.70;
      case 'year': return 0.90;
      default: return 1.0;
    }
  }, [dateRange]);

  const effectiveCollections = Math.round(totalIncome * timeMultiplier);
  const effectiveOperatingExpenses = Math.round(totalExpense * timeMultiplier * 0.4); // Operating expenses excluding trainer cost

  // Core Financial Logic (as required by business model):
  // 1. Client Collections (100%)
  // 2. Trainer Total Cost = Client Collections * (trainerPercentage / 100)
  // 3. Trainer Paid = Trainer Total Cost * (trainerPaidRatio / 100)
  // 4. Trainer Payable = Trainer Total Cost - Trainer Paid (Committed Liability)
  // 5. My Gross Margin = Client Collections - Trainer Total Cost
  // 6. Net Profit = My Gross Margin - Operating Expenses
  // 7. Available Business Cash = Client Collections - Trainer Paid - Operating Expenses - Trainer Payable (or Cash collected minus liabilities)

  const trainerTotalCost = Math.round(effectiveCollections * (trainerPercentage / 100));
  const trainerPaid = Math.round(trainerTotalCost * (trainerPaidRatio / 100));
  const trainerPayable = trainerTotalCost - trainerPaid;
  const grossMargin = effectiveCollections - trainerTotalCost;
  const netProfit = grossMargin - effectiveOperatingExpenses;
  
  // Committed Cash = Trainer Payable (Money already committed to trainers - NOT profit)
  const committedCash = trainerPayable;
  // Available Cash = Cash collected minus paid amounts and pending committed liabilities & expenses
  const availableCash = Math.max(0, effectiveCollections - trainerPaid - effectiveOperatingExpenses - trainerPayable);

  // Pie chart dataset for Client Collections Allocation
  // Slice 1: Trainer Paid
  // Slice 2: Trainer Payable (Committed Liability)
  // Slice 3: My Gross Margin
  const pieData = [
    {
      name: 'Trainer Paid',
      amount: trainerPaid,
      value: trainerPaid,
      percentage: effectiveCollections > 0 ? Math.round((trainerPaid / effectiveCollections) * 100) : 0,
      color: '#10b981', // Emerald
      badge: 'Disbursed',
      description: 'Amount already paid out to trainers'
    },
    {
      name: 'Trainer Payable',
      amount: trainerPayable,
      value: trainerPayable,
      percentage: effectiveCollections > 0 ? Math.round((trainerPayable / effectiveCollections) * 100) : 0,
      color: '#f59e0b', // Amber / Orange
      badge: 'Committed Liability',
      description: 'Outstanding money owed to trainers — NOT PROFIT'
    },
    {
      name: 'My Gross Margin',
      amount: grossMargin,
      value: grossMargin,
      percentage: effectiveCollections > 0 ? Math.round((grossMargin / effectiveCollections) * 100) : 0,
      color: '#6366f1', // Indigo / Purple
      badge: 'Business Portion',
      description: 'Gross business earnings before operating expenses'
    }
  ];

  return (
    <div
      className="relative rounded-3xl p-5 sm:p-7 border backdrop-blur-xl shadow-2xl transition-all duration-300 space-y-6"
      style={{
        background: 'linear-gradient(145deg, rgba(13, 20, 36, 0.95), rgba(8, 14, 26, 0.98))',
        borderColor: 'rgba(99, 102, 241, 0.3)',
      }}
    >
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg sm:text-xl font-black tracking-tight bg-gradient-to-r from-indigo-200 via-emerald-200 to-white bg-clip-text text-transparent">
              Client Collections Allocation & Trainer Financial Breakdown
            </h2>
            <span className="px-3 py-1 text-[10px] font-black rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles size={12} className="text-indigo-400" /> Training Financial Model
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1">
            <Info size={13} className="text-indigo-400 shrink-0" />
            <span>
              Client Collections (100%) split into Trainer Cost ({trainerPercentage}%) and Gross Margin ({100 - trainerPercentage}%). Trainer Payable is an accrued liability.
            </span>
          </p>
        </div>

        {/* Time-Based Filter Toggles & Actions */}
        <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
          {onOpenAddModal && (
            <button
              onClick={onOpenAddModal}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:opacity-90 text-white flex items-center gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer transition-all"
            >
              <PlusCircle size={14} />
              <span>Record Client Payment</span>
            </button>
          )}

          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900/90 border border-slate-800">
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
                    ? 'bg-indigo-600 text-white shadow-md border border-indigo-500/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Total Client Collections"
          value={formatCurrency(effectiveCollections)}
          subtext="100% Pre-orders & Fees"
          icon={DollarSign}
          badge="Gross Cash In"
          badgeType="cyan"
        />
        <MetricCard
          label="Trainer Cost (Total)"
          value={formatCurrency(trainerTotalCost)}
          subtext={`${trainerPercentage}% Allocation of Collections`}
          icon={Users}
          badge="Trainer Share"
          badgeType="purple"
        />
        <MetricCard
          label="Trainer Payable (Owed)"
          value={formatCurrency(trainerPayable)}
          subtext="Committed Liability (NOT Profit)"
          icon={AlertCircle}
          badge="Liability"
          badgeType="rose"
        />
        <MetricCard
          label="My Gross Margin"
          value={formatCurrency(grossMargin)}
          subtext={`${100 - trainerPercentage}% Business Revenue`}
          icon={TrendingUp}
          badge="Gross Profit"
          badgeType="emerald"
        />
      </div>

      {/* Flagship Financial Flow Indicator Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-indigo-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <Receipt size={14} className="text-indigo-400" />
            Financial Flow Logic
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Collections ≠ Net Profit
          </span>
        </div>

        {/* Step Flow Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-800/90 border border-cyan-500/30 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Step 1</span>
            <span className="font-bold text-cyan-300">Client Collections</span>
            <span className="font-mono text-[11px] text-white font-extrabold">{formatCurrency(effectiveCollections)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/90 border border-amber-500/30 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Step 2: Trainer Cost</span>
            <span className="font-bold text-amber-300">
              Paid: {formatCurrency(trainerPaid)} | Owed: {formatCurrency(trainerPayable)}
            </span>
            <span className="font-mono text-[10px] text-amber-400 font-semibold">{trainerPercentage}% Allocation</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/90 border border-indigo-500/30 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Step 3</span>
            <span className="font-bold text-indigo-300">Gross Margin</span>
            <span className="font-mono text-[11px] text-white font-extrabold">{formatCurrency(grossMargin)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/90 border border-rose-500/30 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Step 4</span>
            <span className="font-bold text-rose-300">Operating Expenses</span>
            <span className="font-mono text-[11px] text-rose-200 font-extrabold">{formatCurrency(effectiveOperatingExpenses)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/90 border border-emerald-500/30 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Step 5</span>
            <span className="font-bold text-emerald-300">Net Profit</span>
            <span className="font-mono text-[11px] text-emerald-300 font-extrabold">{formatCurrency(netProfit)}</span>
          </div>
        </div>
      </div>

      {/* Main Pie / Donut Chart & Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center p-5 rounded-3xl bg-slate-900/50 border border-slate-800">
        
        {/* Left 6 Cols: Donut Chart */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full h-72 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="rgba(15, 23, 42, 0.8)"
                      strokeWidth={3}
                      className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name
                  ]}
                  contentStyle={{
                    background: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Overlay Summary */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Total Collections
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-white mt-0.5">
                {formatCurrency(effectiveCollections)}
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 mt-1">
                100% Client Cash
              </span>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Allocation Legend & Detail Rows */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-bold text-slate-200">
              Client Collections Split Allocation
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Hover/Click slice to inspect
            </span>
          </div>

          <div className="space-y-2.5">
            {pieData.map((item) => (
              <div
                key={item.name}
                onMouseEnter={() => setActiveCategory(item.name)}
                onMouseLeave={() => setActiveCategory(null)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  activeCategory === item.name
                    ? 'bg-slate-800 border-indigo-500/50 shadow-lg scale-[1.01]'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{item.name}</span>
                      <span
                        className="px-2 py-0.5 text-[9px] font-black rounded-full"
                        style={{
                          backgroundColor: `${item.color}20`,
                          color: item.color,
                          border: `1px solid ${item.color}40`,
                        }}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-black font-mono text-white block">
                    {formatCurrency(item.amount)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {item.percentage}% of collections
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Safety & Reserve Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        
        {/* Card 1: Committed Cash Reserve Indicator */}
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={15} className="text-amber-400" />
              Committed Cash (Accrued Liability)
            </span>
            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Trainer Obligations
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black font-mono text-amber-200">
                {formatCurrency(committedCash)}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Money owed to trainers for past/active batches
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-amber-400 font-mono">
                {effectiveCollections > 0 ? Math.round((committedCash / effectiveCollections) * 100) : 0}%
              </span>
              <span className="text-[10px] text-slate-400 block font-medium">of Total Collections</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-900/30 border border-amber-500/20 text-[11px] text-amber-200/90 font-medium flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <span>
              <strong>Crucial Rule:</strong> Do NOT treat this ₹{committedCash.toLocaleString('en-IN')} as profit or available spendable business cash.
            </span>
          </div>
        </div>

        {/* Card 2: Available Business Cash Indicator */}
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet size={15} className="text-emerald-400" />
              Safely Available Business Cash
            </span>
            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Unencumbered Cash
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black font-mono text-emerald-300">
                {formatCurrency(availableCash)}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                Cash remaining after reserving trainer payables & operating expenses
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {grossMargin > 0 ? Math.round((availableCash / grossMargin) * 100) : 0}%
              </span>
              <span className="text-[10px] text-slate-400 block font-medium">of Gross Margin</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-900/30 border border-emerald-500/20 text-[11px] text-emerald-200/90 font-medium flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>
              This cash is safe for business expansion, software subscriptions, or partner payouts.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
