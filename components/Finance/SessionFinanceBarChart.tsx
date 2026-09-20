'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';
import {
  BarChart3, RefreshCw, Sparkles, DollarSign, Wallet, Users, Award, ShieldAlert,
  TrendingUp, Layers, CheckCircle2, ArrowUpRight, ChevronLeft, ChevronRight, ChevronDown, PieChart as PieChartIcon,
  Search, Check, X
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// Custom Rich Tooltip for Bar Chart showing Full Batch Title, Trainer, Platform, and all 5 Metrics
const CustomBarTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0b1329]/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl text-white text-xs max-w-sm space-y-2 font-sans z-50">
      {/* Header with Full Title, Platform & Trainer */}
      <div className="border-b border-slate-700/60 pb-2 space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {data.platform}
          </span>
          <span className="text-[11px] text-slate-300 font-semibold">
            Trainer: <strong className="text-emerald-400">{data.trainer || 'Unassigned'}</strong>
          </span>
        </div>
        <h4 className="text-xs sm:text-sm font-extrabold text-white leading-snug">
          {data.fullTitle}
        </h4>
      </div>

      {/* 5 Financial Metrics Breakdown */}
      <div className="space-y-1.5 font-mono text-[11px] pt-0.5">
        <div className="flex items-center justify-between gap-2 text-cyan-300">
          <span className="font-semibold text-slate-300">1. Participant Fee (Total Due):</span>
          <span className="font-bold">{formatCurrency(data.participantTotalDue)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-emerald-300">
          <span className="font-semibold text-slate-300">2. Participant Cash Paid:</span>
          <span className="font-bold">{formatCurrency(data.participantCollections)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-indigo-300">
          <span className="font-semibold text-slate-300">3. Trainer Total Cost:</span>
          <span className="font-bold">{formatCurrency(data.trainerTotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-rose-300">
          <span className="font-semibold text-slate-300">4. Trainer Amount Paid:</span>
          <span className="font-bold">{formatCurrency(data.trainerPaid)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-amber-300">
          <span className="font-semibold text-slate-300">5. Trainer Payable (Due):</span>
          <span className="font-bold">{formatCurrency(data.trainerPayable)}</span>
        </div>
      </div>
    </div>
  );
};

// Custom Animated Batch Selector Dropdown with Smooth Glassmorphism, Search & Rich Metadata Cards
const CustomAnimatedBatchDropdown = ({
  chartData,
  selectedBatchIndex,
  onSelectBatch,
}: {
  chartData: any[];
  selectedBatchIndex: number;
  onSelectBatch: (index: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedBatch = chartData[selectedBatchIndex];

  const filteredBatches = chartData
    .map((b, originalIndex) => ({ ...b, originalIndex }))
    .filter((b) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.fullTitle.toLowerCase().includes(q) ||
        (b.platform && b.platform.toLowerCase().includes(q)) ||
        (b.trainer && b.trainer.toLowerCase().includes(q))
      );
    });

  return (
    <div className="relative flex-1 sm:flex-none min-w-[220px] sm:min-w-[300px] md:min-w-[340px]" ref={dropdownRef}>
      {/* Dropdown Trigger Button (Sleek & Compact) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3.5 py-2 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border transition-all duration-300 cursor-pointer shadow-lg flex items-center justify-between gap-2.5 text-left ${
          isOpen
            ? 'border-cyan-400 ring-2 ring-cyan-500/20 shadow-cyan-500/20'
            : 'border-cyan-500/40 hover:border-cyan-400 shadow-cyan-500/10'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="px-2 py-0.5 text-[9px] font-black rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0 font-mono">
            #{selectedBatchIndex + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-extrabold text-white truncate max-w-[160px] sm:max-w-[220px]">
                {selectedBatch?.fullTitle || 'Select Batch...'}
              </span>
              {selectedBatch?.platform && (
                <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 hidden sm:inline-block">
                  {selectedBatch.platform}
                </span>
              )}
            </div>
            {selectedBatch && (
              <p className="text-[9px] text-slate-400 font-medium truncate">
                Trainer: <strong className="text-emerald-400">{selectedBatch.trainer || 'Unassigned'}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-mono font-bold text-slate-400 hidden sm:inline-block">
            {selectedBatchIndex + 1}/{chartData.length}
          </span>
          <div
            className={`w-6 h-6 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-cyan-400 transition-transform duration-300 ease-in-out ${
              isOpen ? 'rotate-180 bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'rotate-0'
            }`}
          >
            <ChevronDown size={14} />
          </div>
        </div>
      </button>

      {/* Animated Dropdown Menu Popover (Compact Glass Card) */}
      <div
        className={`absolute top-full left-0 right-0 mt-1.5 z-50 min-w-[280px] sm:min-w-[360px] bg-[#0c1427]/98 border border-cyan-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl rounded-2xl p-2.5 space-y-2 transition-all duration-300 ease-out origin-top transform ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* Search Bar inside Menu */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search batch, platform or trainer..."
            className="w-full pl-8 pr-7 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 bg-slate-950/90 border border-slate-700/80 rounded-lg focus:outline-none focus:border-cyan-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-800"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Batch Cards List */}
        <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {filteredBatches.length === 0 ? (
            <div className="p-3 text-center text-[11px] text-slate-400 font-medium">
              No matching batches found.
            </div>
          ) : (
            filteredBatches.map((b) => {
              const isSelected = b.originalIndex === selectedBatchIndex;
              return (
                <div
                  key={b.id || b.originalIndex}
                  onClick={() => {
                    onSelectBatch(b.originalIndex);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 rounded-lg border transition-all duration-200 cursor-pointer flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/80 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-mono font-black rounded border shrink-0 ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      #{b.originalIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="text-[11px] font-bold text-white truncate max-w-[180px] sm:max-w-[220px]">
                          {b.fullTitle}
                        </h5>
                        {b.platform && (
                          <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {b.platform}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-slate-400 font-medium mt-0.5">
                        <span>
                          Trainer: <strong className="text-emerald-400">{b.trainer || 'Unassigned'}</strong>
                        </span>
                        <span>•</span>
                        <span>Tuition: <strong className="text-cyan-300">{formatCurrency(b.participantTotalDue)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/40">
                      <CheckCircle2 size={12} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Dropdown Menu Footer */}
        <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400 px-1 font-mono">
          <span>{chartData.length} total active batches</span>
          <span className="text-cyan-400">Click batch to select</span>
        </div>
      </div>
    </div>
  );
};

export default function SessionFinanceBarChart() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number>(0);
  const [activePieHover, setActivePieHover] = useState<string | null>(null);

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
      sessionTitle: s.title ? (s.title.length > 22 ? s.title.substring(0, 22) + '...' : s.title) : s.platform,
      fullTitle: s.title || s.platform,
      platform: s.platform,
      trainer: s.trainer,
      date: s.date,
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

  // Selected batch for Pie Chart breakdown
  const selectedBatch = chartData.length > 0 ? chartData[Math.min(selectedBatchIndex, chartData.length - 1)] : null;

  // 2-Value Pie Chart Data: Participant Tuition Fee (Expected) vs Trainer Total Payable (Contract Fee)
  const selectedBatchPieData = selectedBatch ? [
    {
      name: 'Participant Tuition Fee',
      value: selectedBatch.participantTotalDue,
      actualPaid: selectedBatch.participantCollections,
      color: '#06b6d4',
      gradId: 'pieGradParticipantFee',
      badge: 'Participant Tuition',
    },
    {
      name: 'Trainer Total Contract Fee',
      value: selectedBatch.trainerTotal,
      actualPaid: selectedBatch.trainerPaid,
      color: '#818cf8',
      gradId: 'pieGradTrainerContract',
      badge: 'Trainer Fee',
    },
  ] : [];

  const pieTotal = selectedBatchPieData.reduce((sum, item) => sum + item.value, 0);

  const handlePrevBatch = () => {
    if (chartData.length === 0) return;
    setSelectedBatchIndex((prev) => (prev > 0 ? prev - 1 : chartData.length - 1));
  };

  const handleNextBatch = () => {
    if (chartData.length === 0) return;
    setSelectedBatchIndex((prev) => (prev < chartData.length - 1 ? prev + 1 : 0));
  };

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
              <Sparkles size={12} className="text-emerald-400" /> 5-Metric Batch Breakdown & Pie Analysis
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
                <Tooltip content={<CustomBarTooltip />} />
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

      {/* Interactive Batch Financial Contract Pie Chart Box */}
      <div className="p-5 sm:p-7 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-2xl space-y-5 relative z-10">
        {/* Header & Controls (Dropdown Box + Prev / Next) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <PieChartIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Batch Financial Pie Chart Comparison
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  2-Metric Ratio
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">
                Comparing <strong className="text-cyan-400">Participant Tuition Fee</strong> vs <strong className="text-indigo-400">Trainer Total Contract Fee</strong>
              </p>
            </div>
          </div>

          {/* Controls: Expanded Executive Dropdown Box Selector + Previous / Next Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Custom Animated Glassmorphic Batch Dropdown Box */}
            <CustomAnimatedBatchDropdown
              chartData={chartData}
              selectedBatchIndex={selectedBatchIndex}
              onSelectBatch={setSelectedBatchIndex}
            />

            {/* Toggle Prev & Next Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 justify-end">
              <button
                onClick={handlePrevBatch}
                disabled={chartData.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-700/80 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-extrabold transition-all cursor-pointer disabled:opacity-40 shadow-md active:scale-95"
                title="Previous Batch"
              >
                <ChevronLeft size={15} />
                <span>Prev</span>
              </button>

              <span className="px-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-cyan-400 shrink-0">
                {chartData.length > 0 ? `${selectedBatchIndex + 1}/${chartData.length}` : '0/0'}
              </span>

              <button
                onClick={handleNextBatch}
                disabled={chartData.length === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-extrabold transition-all cursor-pointer disabled:opacity-40 shadow-lg shadow-cyan-500/10 active:scale-95"
                title="Next Batch"
              >
                <span>Next</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Selected Batch Details Banner */}
        {selectedBatch && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {selectedBatch.platform}
                </span>
                <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
                  {selectedBatch.fullTitle}
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Trainer: <strong className="text-emerald-400">{selectedBatch.trainer || 'Arul Xavier'}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Projected Net Margin</span>
                <span className={`text-sm sm:text-base font-black font-mono ${(selectedBatch.participantTotalDue - selectedBatch.trainerTotal) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(selectedBatch.participantTotalDue - selectedBatch.trainerTotal)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Pie Chart & Interactive Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2">
          {/* Left: Large Graphical 2-Value Pie Chart */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center relative min-h-[300px] sm:min-h-[360px]">
            {selectedBatchPieData.length === 0 || pieTotal === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-500 text-xs font-semibold space-y-2 p-8 border border-dashed border-slate-800 rounded-2xl">
                <PieChartIcon size={32} className="text-slate-600 animate-pulse" />
                <span>No financial contract entries recorded for this batch yet.</span>
              </div>
            ) : (
              <div className="relative w-full h-[320px] sm:h-[360px] flex items-center justify-center animate-fade-in" key={selectedBatchIndex}>
                {/* Glowing SVG Gradients for Pie Slices */}
                <svg className="absolute w-0 h-0 overflow-hidden">
                  <defs>
                    <linearGradient id="pieGradParticipantFee" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#0891b2" />
                    </linearGradient>
                    <linearGradient id="pieGradTrainerContract" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                </svg>

                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={selectedBatchPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={128}
                      paddingAngle={6}
                      dataKey="value"
                      stroke="rgba(11, 19, 41, 0.95)"
                      strokeWidth={4}
                      cornerRadius={8}
                      onMouseEnter={(_, index) => setActivePieHover(selectedBatchPieData[index]?.name || null)}
                      onMouseLeave={() => setActivePieHover(null)}
                    >
                      {selectedBatchPieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={`url(#${entry.gradId})`}
                          className="transition-all duration-300 cursor-pointer outline-none"
                          style={{
                            filter: activePieHover === entry.name ? 'brightness(1.25) drop-shadow(0 0 16px rgba(34, 211, 238, 0.6))' : 'brightness(1.0)',
                            transform: activePieHover === entry.name ? 'scale(1.05)' : 'scale(1)',
                            transformOrigin: 'center center',
                          }}
                        />
                      ))}
                    </Pie>

                    {/* Non-overlapping Top-Corner Tooltip Banner */}
                    <Tooltip
                      position={{ x: 10, y: 10 }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0];
                        if (!data) return null;

                        return (
                          <div className="px-3.5 py-2 rounded-xl bg-slate-900/95 border border-slate-700/90 shadow-xl backdrop-blur-md text-white text-xs flex items-center gap-2.5 z-50 pointer-events-none">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ background: data.payload.color }} />
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200 font-extrabold">{data.name}:</span>
                              <span className="font-black font-mono text-cyan-300">{formatCurrency(data.value)}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({pieTotal > 0 ? ((data.value / pieTotal) * 100).toFixed(1) : '0'}%)</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Dynamic Donut Center Display Overlay (Zero Overlap Guarantee) */}
                {(() => {
                  const hoveredItem = selectedBatchPieData.find((item) => item.name === activePieHover);
                  if (hoveredItem) {
                    const pct = pieTotal > 0 ? ((hoveredItem.value / pieTotal) * 100).toFixed(1) : '0';
                    return (
                      <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none z-10 transition-all duration-300">
                        <span
                          className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-0.5"
                          style={{
                            color: hoveredItem.color,
                            backgroundColor: `${hoveredItem.color}15`,
                            borderColor: `${hoveredItem.color}40`,
                          }}
                        >
                          {hoveredItem.badge}
                        </span>
                        <span className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                          {formatCurrency(hoveredItem.value)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-300 mt-0.5 font-mono">
                          {pct}% of contract total
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none z-10 transition-all duration-300">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Batch Contract Sum
                      </span>
                      <span className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                        {formatCurrency(pieTotal)}
                      </span>
                      <span className="text-[10px] font-bold text-cyan-400 mt-0.5">
                        2 Metric Ratio
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Right: Legend Breakdown Cards */}
          <div className="lg:col-span-5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Batch Contract Allocation
            </h5>

            {selectedBatchPieData.map((item) => {
              const pct = pieTotal > 0 ? ((item.value / pieTotal) * 100).toFixed(1) : '0';

              return (
                <div
                  key={item.name}
                  onMouseEnter={() => setActivePieHover(item.name)}
                  onMouseLeave={() => setActivePieHover(null)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activePieHover === item.name
                      ? 'bg-slate-800 border-slate-600 shadow-lg scale-[1.02]'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ background: item.color }} />
                      <span className="text-xs font-bold text-slate-200 truncate">{item.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md border ${item.badge === 'Participant Tuition' ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'}`}>
                      {item.badge}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <div>
                      <span className="text-base sm:text-lg font-black font-mono text-white block">
                        {formatCurrency(item.value)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Actual Disbursed / Collected: <strong className="text-emerald-400">{formatCurrency(item.actualPaid)}</strong>
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-300 font-mono">
                      {pct}%
                    </span>
                  </div>

                  {/* Graphical Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

