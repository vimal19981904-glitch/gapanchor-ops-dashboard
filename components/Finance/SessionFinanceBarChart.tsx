'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  BarChart3, RefreshCw, Sparkles, DollarSign, Wallet, Users, Award, ShieldAlert,
  TrendingUp, Layers, CheckCircle2, ArrowUpRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function SessionFinanceBarChart() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessionsData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops');
      const json = await res.json();
      if (json.success && Array.isArray(json.sessions)) {
        setSessions(json.sessions);
      }
    } catch (err) {
      console.error('Error fetching session finance data for bar graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionsData();
  }, []);

  // Format data for Bar Chart per Session / Batch with 5 financial metrics
  const chartData = sessions.map((s) => {
    const participantCollections = Array.isArray(s.participants)
      ? s.participants.reduce((sum: number, p: any) => sum + (p.amountPaid || 0), 0)
      : 0;

    const participantTotalDue = Array.isArray(s.participants)
      ? s.participants.reduce((sum: number, p: any) => sum + (p.amountDue || 0), 0)
      : 0;

    const trainerPaid = s.trainerAmountPaid || 0;
    const trainerTotal = s.trainerTotalCost || 0;
    const trainerPayable = s.trainerAmountDue !== undefined
      ? s.trainerAmountDue
      : Math.max(0, trainerTotal - trainerPaid);

    const sessionMargin = participantCollections - trainerPaid;

    return {
      id: s.id,
      sessionTitle: s.title ? (s.title.length > 20 ? s.title.substring(0, 20) + '...' : s.title) : s.platform,
      fullTitle: s.title || s.platform,
      platform: s.platform,
      trainer: s.trainer,
      participantTotalDue,
      participantCollections,
      trainerTotal,
      trainerPaid,
      trainerPayable,
      sessionMargin,
    };
  });

  // Calculate totals across sessions
  const grandParticipantTotalDue = chartData.reduce((acc, d) => acc + d.participantTotalDue, 0);
  const grandParticipantCollections = chartData.reduce((acc, d) => acc + d.participantCollections, 0);
  const grandTrainerTotal = chartData.reduce((acc, d) => acc + d.trainerTotal, 0);
  const grandTrainerPaid = chartData.reduce((acc, d) => acc + d.trainerPaid, 0);
  const grandTrainerPayable = chartData.reduce((acc, d) => acc + d.trainerPayable, 0);
  const grandNetProfit = grandParticipantCollections - grandTrainerPaid;

  return (
    <div
      className="relative rounded-3xl p-6 sm:p-8 border backdrop-blur-2xl shadow-[0_15px_50px_rgba(0,0,0,0.6)] transition-all duration-300 space-y-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(13, 22, 44, 0.96) 0%, rgba(7, 12, 24, 0.98) 100%)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
      }}
    >
      {/* Decorative Glow Elements */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 relative z-10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <BarChart3 size={20} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Training Session & Batch Finance Tracking
            </h2>
            <span className="px-3 py-1 text-[10px] font-black rounded-full bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
              <Sparkles size={12} className="text-emerald-400" /> 5-Metric Batch Breakdown
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium max-w-3xl">
            Real-time batch level financial performance: Participant Tuition Due vs Collections, Overall Trainer Contract, Disbursed Compensation & Outstanding Payable.
          </p>
        </div>

        <button
          onClick={fetchSessionsData}
          disabled={loading}
          className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/80 text-slate-200 text-xs font-extrabold flex items-center gap-2.5 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/10 self-start sm:self-auto shrink-0 active:scale-95"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-400' : 'text-slate-400'} />
          <span>Refresh Graph</span>
        </button>
      </div>

      {/* 5 Executive Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 relative z-10">
        {/* Card 1: Participant Total Due */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 via-slate-900/60 to-slate-950/80 border border-cyan-500/30 shadow-md hover:border-cyan-500/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider">
              Participant Fee (Due)
            </span>
            <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <Users size={12} />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-cyan-300 mt-1 block">
            {formatCurrency(grandParticipantTotalDue)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1 font-medium">Total expected tuition</span>
        </div>

        {/* Card 2: Participant Paid */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-950/80 border border-emerald-500/30 shadow-md hover:border-emerald-500/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
              Participant Paid
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Wallet size={12} />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300 mt-1 block">
            {formatCurrency(grandParticipantCollections)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1 font-medium">Actual cash collected</span>
        </div>

        {/* Card 3: Trainer Total Cost */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-slate-950/80 border border-indigo-500/30 shadow-md hover:border-indigo-500/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider">
              Trainer Total Cost
            </span>
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Award size={12} />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-indigo-300 mt-1 block">
            {formatCurrency(grandTrainerTotal)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1 font-medium">Overall contract fee</span>
        </div>

        {/* Card 4: Trainer Amount Paid */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/30 via-slate-900/60 to-slate-950/80 border border-rose-500/30 shadow-md hover:border-rose-500/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-wider">
              Trainer Amount Paid
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <DollarSign size={12} />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-rose-300 mt-1 block">
            {formatCurrency(grandTrainerPaid)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1 font-medium">Disbursed compensation</span>
        </div>

        {/* Card 5: Trainer Outstanding Due */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-slate-950/80 border border-amber-500/30 shadow-md hover:border-amber-500/60 transition-all col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">
              Trainer Outstanding
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ShieldAlert size={12} />
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black font-mono text-amber-300 mt-1 block">
            {formatCurrency(grandTrainerPayable)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1 font-medium">Committed liability</span>
        </div>
      </div>

      {/* Main Bar Chart Box */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/70 border border-slate-800/90 shadow-inner space-y-4 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-extrabold text-slate-200 tracking-wide">
              Per-Session 5-Bar Financial Comparison
            </span>
          </div>

          {/* Styled Legend */}
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold">
            <span className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block shadow-sm" /> 1. Participant Fee (Due)
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block shadow-sm" /> 2. Participant Paid
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400 inline-block shadow-sm" /> 3. Trainer Total Cost
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block shadow-sm" /> 4. Trainer Paid
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block shadow-sm" /> 5. Trainer Payable (Due)
            </span>
          </div>
        </div>

        {/* Recharts Canvas */}
        <div className="h-84 sm:h-96 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 font-semibold">
              No session finance data available. Add sessions in the Operation & Training dashboard to populate this bar graph.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 15, right: 25, left: 10, bottom: 25 }}
                barCategoryGap="22%"
                barGap={4}
              >
                {/* SVG Gradients for Glowing Bars */}
                <defs>
                  <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="gradEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="gradIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="gradRose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                    <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.7} />
                <XAxis
                  dataKey="sessionTitle"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  dx={-4}
                />
                <Tooltip
                  formatter={(value: any, name: any, item: any) => {
                    const key = item?.dataKey || name;
                    let label = String(name || '');
                    if (key === 'participantTotalDue') label = '1. Participant Fee (Total Due)';
                    else if (key === 'participantCollections') label = '2. Participant Cash Paid';
                    else if (key === 'trainerTotal') label = '3. Trainer Total Contract Cost';
                    else if (key === 'trainerPaid') label = '4. Trainer Amount Paid';
                    else if (key === 'trainerPayable') label = '5. Trainer Payable (Outstanding Due)';
                    return [formatCurrency(Number(value || 0)), label];
                  }}
                  contentStyle={{
                    background: 'rgba(11, 19, 41, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '12px 16px',
                  }}
                />
                <Bar
                  dataKey="participantTotalDue"
                  name="Participant Fee (Total Due)"
                  fill="url(#gradCyan)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="participantCollections"
                  name="Participant Cash Paid"
                  fill="url(#gradEmerald)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="trainerTotal"
                  name="Trainer Total Contract Cost"
                  fill="url(#gradIndigo)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="trainerPaid"
                  name="Trainer Amount Paid"
                  fill="url(#gradRose)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="trainerPayable"
                  name="Trainer Payable (Outstanding Due)"
                  fill="url(#gradAmber)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
