'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, ArrowLeft, RefreshCw, Calendar, DollarSign, MessageSquare, Briefcase,
  TrendingUp, Layers, CheckCircle2, ChevronRight, Award, Zap, Filter, PieChart as PieChartIcon,
  Activity, Users, ShieldCheck, Tag, X, ChevronDown
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { NavDrawerButton } from '@/components/NavigationContext';
import { toast } from 'sonner';

// Neon & Matte Dark Theme Palette (Matching Reference Image)
const NEON_COLORS = {
  lime: '#a3e635',     // Neon Lime / Green
  purple: '#8b5cf6',   // Neon Violet / Purple
  cyan: '#06b6d4',     // Electric Cyan
  coral: '#f43f5e',    // Coral / Pink
  amber: '#f59e0b',    // Electric Amber
  teal: '#14b8a6',     // Teal
};

const PIE_PALETTE = ['#a3e635', '#8b5cf6', '#06b6d4', '#f43f5e', '#f59e0b', '#3b82f6', '#14b8a6'];

type TimeFrame = 'daily' | 'weekly' | 'monthly';

// Circular Progress Gauge Component (Directly modeled on reference design)
function CircularGauge({ value, label, subtext, color }: { value: number; label: string; subtext: string; color: string }) {
  const radius = 36;
  const stroke = 6.5;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="bg-[#0e1422] border border-white/10 p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center gap-3.5">
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle
            stroke="rgba(255,255,255,0.08)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.6s ease-in-out' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <span className="absolute text-xs sm:text-sm font-black font-mono text-white">{value}%</span>
      </div>
      <div className="min-w-0">
        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block truncate">
          {label}
        </span>
        <span className="text-xs sm:text-sm font-black text-white block mt-0.5 truncate">{subtext}</span>
      </div>
    </div>
  );
}

// Custom Tooltip for Sleek Dark Matte UI
function CustomChartTooltip({ active, payload, label, unit = '' }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0f1d]/95 backdrop-blur-2xl border border-white/15 p-3 rounded-2xl shadow-2xl space-y-1.5 text-xs text-white z-50">
        <p className="font-black text-lime-400 border-b border-slate-800 pb-1 flex items-center gap-1.5">
          <Calendar size={13} className="text-lime-400" />
          {label}
        </p>
        {payload.map((item: any, index: number) => (
          <div key={`tt-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color || item.fill || NEON_COLORS.lime }} />
              {item.name}:
            </span>
            <span className="font-black font-mono text-white">
              {typeof item.value === 'number' && (item.name?.toLowerCase().includes('income') || item.name?.toLowerCase().includes('expense') || item.name?.toLowerCase().includes('credit') || item.name?.toLowerCase().includes('debit'))
                ? formatCurrency(item.value)
                : `${item.value} ${unit}`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// Concentric Radial Arc Graph Component (Modeled on user's Event Statistics reference image)
function ConcentricRadialArcGraph({
  title,
  data,
  totalLabel,
  isCurrency = false,
  unit = '',
  hideCenterText = false,
}: {
  title: string;
  data: { name: string; value: number }[];
  totalLabel: string;
  isCurrency?: boolean;
  unit?: string;
  hideCenterText?: boolean;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  // Concentric arc ring configurations (Outer to Inner)
  const ringConfigs = [
    { radius: 76, strokeWidth: 9, color: '#8b5cf6' }, // Violet / Purple (Outer)
    { radius: 62, strokeWidth: 9, color: '#facc15' }, // Neon Yellow / Gold
    { radius: 48, strokeWidth: 9, color: '#38bdf8' }, // Cyan / Electric Blue
    { radius: 34, strokeWidth: 9, color: '#f43f5e' }, // Coral / Pink (Inner)
  ];

  const svgSize = 200;
  const center = svgSize / 2;
  const arcSweepDeg = 240; // 240-degree concentric arc sweep
  const startRotateDeg = 150; // Starts from 150° rotation for symmetrical arc display

  return (
    <div className="bg-[#0b101d] border border-white/10 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-xs font-black text-slate-200 uppercase tracking-wider">{title}</span>
        <span className="text-[10px] font-mono font-bold text-lime-400 bg-lime-400/10 border border-lime-400/20 px-2 py-0.5 rounded-full">
          {data.length} Categories
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Concentric Radial Arc Graph Display */}
        <div className="sm:col-span-5 relative flex items-center justify-center py-1">
          <div className="relative w-[190px] h-[190px] flex items-center justify-center">
            <svg width={svgSize} height={svgSize} className="w-full h-full">
              {data.slice(0, 4).map((item, idx) => {
                const cfg = ringConfigs[idx % ringConfigs.length];
                const r = cfg.radius;
                const circumference = 2 * Math.PI * r;

                // Proportion relative to max value or total value
                const pct = Math.min(100, Math.max(8, (item.value / maxVal) * 100));

                const maxArcLength = (arcSweepDeg / 360) * circumference;
                const filledLength = (pct / 100) * maxArcLength;

                return (
                  <g key={`concentric-ring-${idx}`}>
                    {/* Background Faint Track Arc */}
                    <circle
                      cx={center}
                      cy={center}
                      r={r}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeWidth={cfg.strokeWidth}
                      strokeDasharray={`${maxArcLength} ${circumference}`}
                      strokeLinecap="round"
                      transform={`rotate(${startRotateDeg} ${center} ${center})`}
                    />
                    {/* Glowing Animated Foreground Arc */}
                    <circle
                      cx={center}
                      cy={center}
                      r={r}
                      fill="none"
                      stroke={cfg.color}
                      strokeWidth={cfg.strokeWidth}
                      strokeDasharray={`${filledLength} ${circumference}`}
                      strokeLinecap="round"
                      transform={`rotate(${startRotateDeg} ${center} ${center})`}
                      style={{
                        transition: 'stroke-dasharray 1s ease-out, stroke 0.4s ease',
                        filter: `drop-shadow(0px 0px 5px ${cfg.color}90)`,
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Center Summary Metric Display (Omitted if hideCenterText is true) */}
            {!hideCenterText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-2">
                <span className="text-xs sm:text-sm font-black font-mono text-lime-300 truncate max-w-[100px] drop-shadow-md">
                  {isCurrency ? formatCurrency(total) : total}
                </span>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                  {totalLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Legend List with Rounded Square Swatches & Share Badges */}
        <div className="sm:col-span-7 space-y-2">
          {data.map((item, idx) => {
            const cfg = ringConfigs[idx % ringConfigs.length] || { color: PIE_PALETTE[idx % PIE_PALETTE.length] };
            const pct = total > 0 ? (item.value / total) * 100 : 0;

            return (
              <div
                key={item.name}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-white/5 hover:border-white/15 transition-all text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Soft Rounded Square Swatch matching the reference image! */}
                  <span
                    className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                    style={{
                      background: cfg.color,
                      boxShadow: `0 0 6px ${cfg.color}80`,
                    }}
                  />
                  <span className="font-bold text-slate-200 truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2 font-mono">
                  <span className="font-black text-white text-[11px] sm:text-xs">
                    {isCurrency ? formatCurrency(item.value) : `${item.value} ${unit}`}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function OpsAnalyticsPage() {
  const [financeData, setFinanceData] = useState<any>(null);
  const [commsData, setCommsData] = useState<any>(null);
  const [jobSupportData, setJobSupportData] = useState<any>(null);
  const [opsData, setOpsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Independent Timeframe Frame for Each Component Graph
  const [financeFrame, setFinanceFrame] = useState<TimeFrame>('daily');
  const [leadsFrame, setLeadsFrame] = useState<TimeFrame>('daily');
  const [jobSupportFrame, setJobSupportFrame] = useState<TimeFrame>('daily');
  const [opsFrame, setOpsFrame] = useState<TimeFrame>('daily');
  const [calendarFrame, setCalendarFrame] = useState<TimeFrame>('daily');

  // Custom Time Range & Month Filter State
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      const [finRes, commsRes, jsRes, opsRes] = await Promise.all([
        fetch('/api/finance'),
        fetch('/api/comms'),
        fetch('/api/job-support/session'),
        fetch('/api/ops'),
      ]);

      const [finJson, commsJson, jsJson, opsJson] = await Promise.all([
        finRes.json(), commsRes.json(), jsRes.json(), opsRes.json(),
      ]);

      if (finJson.success) setFinanceData(finJson);
      if (commsJson.success) setCommsData(commsJson);
      if (jsJson.success) setJobSupportData(jsJson);
      if (opsJson.success) setOpsData(opsJson);
    } catch (err) {
      toast.error('Error fetching analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAnalytics();
  }, []);

  // Filter helper for custom date range & month selection
  const filterByTimeRange = (itemDate: Date | string) => {
    const d = new Date(itemDate);
    if (isNaN(d.getTime())) return true;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (d < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }

    if (selectedMonth !== 'all') {
      const monthShort = d.toLocaleString('en-IN', { month: 'short' }).toLowerCase();
      if (monthShort !== selectedMonth.toLowerCase()) return false;
    }

    return true;
  };

  // ─── 1. Finance Multi-Chart Analytics ─────────────────────
  const financeAnalytics = useMemo(() => {
    const txs: any[] = (financeData?.transactions || []).filter((t: any) => filterByTimeRange(t.date));

    const dailyMap: Record<string, { label: string; income: number; expense: number; net: number; timestamp: number }> = {};
    const weeklyMap: Record<string, { label: string; income: number; expense: number; net: number; timestamp: number }> = {};
    const monthlyMap: Record<string, { label: string; income: number; expense: number; net: number; timestamp: number }> = {};
    const categoryMap: Record<string, number> = {};

    let peakDay = { date: 'N/A', amount: 0 };
    let peakMonth = { month: 'N/A', amount: 0 };

    txs.forEach((t) => {
      const d = new Date(t.date);
      const dayStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const monthStr = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      const fullMonthStr = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      // Category breakdown
      const cat = t.sourceOrCategory || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;

      // Daily Grouping
      const dayTimestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (!dailyMap[dayStr]) {
        dailyMap[dayStr] = { label: dayStr, income: 0, expense: 0, net: 0, timestamp: dayTimestamp };
      }

      if (t.type === 'income') {
        dailyMap[dayStr].income += t.amount;
        if (t.amount > peakDay.amount) {
          peakDay = { date: dayStr, amount: t.amount };
        }
      } else {
        dailyMap[dayStr].expense += t.amount;
      }
      dailyMap[dayStr].net = dailyMap[dayStr].income - dailyMap[dayStr].expense;

      // Weekly Grouping
      const startOfWeek = new Date(d);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStr = `Wk of ${startOfWeek.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;

      if (!weeklyMap[weekStr]) {
        weeklyMap[weekStr] = { label: weekStr, income: 0, expense: 0, net: 0, timestamp: startOfWeek.getTime() };
      }
      if (t.type === 'income') weeklyMap[weekStr].income += t.amount;
      else weeklyMap[weekStr].expense += t.amount;
      weeklyMap[weekStr].net = weeklyMap[weekStr].income - weeklyMap[weekStr].expense;

      // Monthly Grouping
      const monthTimestamp = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      if (!monthlyMap[monthStr]) {
        monthlyMap[monthStr] = { label: monthStr, income: 0, expense: 0, net: 0, timestamp: monthTimestamp };
      }
      if (t.type === 'income') monthlyMap[monthStr].income += t.amount;
      else monthlyMap[monthStr].expense += t.amount;
      monthlyMap[monthStr].net = monthlyMap[monthStr].income - monthlyMap[monthStr].expense;

      if (monthlyMap[monthStr].income > peakMonth.amount) {
        peakMonth = { month: fullMonthStr, amount: monthlyMap[monthStr].income };
      }
    });

    const dailyChart = Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-25);
    const weeklyChart = Object.values(weeklyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-12);
    const monthlyChart = Object.values(monthlyMap).sort((a, b) => a.timestamp - b.timestamp);
    const categoryPieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    return { dailyChart, weeklyChart, monthlyChart, categoryPieData, peakDay, peakMonth };
  }, [financeData, startDate, endDate, selectedMonth]);

  // ─── 2. Leads Multi-Chart Analytics (LINE GRAPH) ───────────
  const leadsAnalytics = useMemo(() => {
    const enquiries: any[] = (commsData?.enquiries || []).filter((e: any) =>
      filterByTimeRange(e.messageTimestamp || e.createdAt || new Date())
    );

    const dailyMap: Record<string, { label: string; count: number; timestamp: number }> = {};
    const weeklyMap: Record<string, { label: string; count: number; timestamp: number }> = {};
    const monthlyMap: Record<string, { label: string; count: number; timestamp: number }> = {};
    const statusMap: Record<string, number> = {};

    let peakDay = { date: 'N/A', count: 0 };
    let peakMonth = { month: 'N/A', count: 0 };

    enquiries.forEach((e) => {
      const d = new Date(e.messageTimestamp || e.createdAt || new Date());
      const dayStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const monthStr = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      const fullMonthStr = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      // Status Breakdown
      const st = e.status || (e.isStale ? 'Action Required' : 'Open');
      statusMap[st] = (statusMap[st] || 0) + 1;

      // Daily Grouping
      const dayTimestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      dailyMap[dayStr] = dailyMap[dayStr] || { label: dayStr, count: 0, timestamp: dayTimestamp };
      dailyMap[dayStr].count += 1;

      if (dailyMap[dayStr].count > peakDay.count) {
        peakDay = { date: dayStr, count: dailyMap[dayStr].count };
      }

      // Weekly Grouping
      const startOfWeek = new Date(d);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStr = `Wk of ${startOfWeek.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;

      weeklyMap[weekStr] = weeklyMap[weekStr] || { label: weekStr, count: 0, timestamp: startOfWeek.getTime() };
      weeklyMap[weekStr].count += 1;

      // Monthly Grouping
      const monthTimestamp = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      monthlyMap[monthStr] = monthlyMap[monthStr] || { label: monthStr, count: 0, timestamp: monthTimestamp };
      monthlyMap[monthStr].count += 1;

      if (monthlyMap[monthStr].count > peakMonth.count) {
        peakMonth = { month: fullMonthStr, count: monthlyMap[monthStr].count };
      }
    });

    const dailyChart = Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-25);
    const weeklyChart = Object.values(weeklyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-12);
    const monthlyChart = Object.values(monthlyMap).sort((a, b) => a.timestamp - b.timestamp);
    const statusPieData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    return { dailyChart, weeklyChart, monthlyChart, statusPieData, peakDay, peakMonth };
  }, [commsData, startDate, endDate, selectedMonth]);

  // ─── 3. Job Support Operations Multi-Chart Analytics ───────
  const jobSupportAnalytics = useMemo(() => {
    const sessions: any[] = (jobSupportData?.sessions || []).filter((s: any) => filterByTimeRange(s.date || new Date()));

    const dailyMap: Record<string, { label: string; count: number; timestamp: number }> = {};
    const weeklyMap: Record<string, { label: string; count: number; timestamp: number }> = {};
    const monthlyMap: Record<string, { label: string; count: number; timestamp: number }> = {};
    const platformMap: Record<string, number> = {};

    let peakDay = { date: 'N/A', count: 0 };
    let peakMonth = { month: 'N/A', count: 0 };

    sessions.forEach((s) => {
      const d = new Date(s.date || new Date());
      const dayStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const monthStr = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      const fullMonthStr = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      // Platform
      const pf = s.platform || 'General';
      platformMap[pf] = (platformMap[pf] || 0) + 1;

      // Daily Grouping
      const dayTimestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      dailyMap[dayStr] = dailyMap[dayStr] || { label: dayStr, count: 0, timestamp: dayTimestamp };
      dailyMap[dayStr].count += 1;

      if (dailyMap[dayStr].count > peakDay.count) {
        peakDay = { date: dayStr, count: dailyMap[dayStr].count };
      }

      // Weekly Grouping
      const startOfWeek = new Date(d);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStr = `Wk of ${startOfWeek.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;

      weeklyMap[weekStr] = weeklyMap[weekStr] || { label: weekStr, count: 0, timestamp: startOfWeek.getTime() };
      weeklyMap[weekStr].count += 1;

      // Monthly Grouping
      const monthTimestamp = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      monthlyMap[monthStr] = monthlyMap[monthStr] || { label: monthStr, count: 0, timestamp: monthTimestamp };
      monthlyMap[monthStr].count += 1;

      if (monthlyMap[monthStr].count > peakMonth.count) {
        peakMonth = { month: fullMonthStr, count: monthlyMap[monthStr].count };
      }
    });

    const dailyChart = Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-25);
    const weeklyChart = Object.values(weeklyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-12);
    const monthlyChart = Object.values(monthlyMap).sort((a, b) => a.timestamp - b.timestamp);
    const platformPieData = Object.entries(platformMap).map(([name, value]) => ({ name, value }));

    return { dailyChart, weeklyChart, monthlyChart, platformPieData, peakDay, peakMonth };
  }, [jobSupportData, startDate, endDate, selectedMonth]);

  // ─── 4. Training Operations Multi-Chart Analytics ──────────
  const opsAnalyticsData = useMemo(() => {
    const sessions: any[] = (opsData?.sessions || []).filter((s: any) => filterByTimeRange(s.date || new Date()));

    const dailyMap: Record<string, { label: string; trainees: number; sessions: number; timestamp: number }> = {};
    const weeklyMap: Record<string, { label: string; trainees: number; sessions: number; timestamp: number }> = {};
    const monthlyMap: Record<string, { label: string; trainees: number; sessions: number; timestamp: number }> = {};
    const platformMap: Record<string, number> = {};

    let peakDay = { date: 'N/A', count: 0 };
    let peakMonth = { month: 'N/A', count: 0 };

    sessions.forEach((s) => {
      const d = new Date(s.date || new Date());
      const dayStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const monthStr = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      const fullMonthStr = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const count = s.participantsCount || s.currentlyParticipating || 1;

      // Platform
      const pf = s.platform || 'SCM Core';
      platformMap[pf] = (platformMap[pf] || 0) + count;

      // Daily Grouping
      const dayTimestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      dailyMap[dayStr] = dailyMap[dayStr] || { label: dayStr, trainees: 0, sessions: 0, timestamp: dayTimestamp };
      dailyMap[dayStr].trainees += count;
      dailyMap[dayStr].sessions += 1;

      if (dailyMap[dayStr].trainees > peakDay.count) {
        peakDay = { date: dayStr, count: dailyMap[dayStr].trainees };
      }

      // Weekly Grouping
      const startOfWeek = new Date(d);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStr = `Wk of ${startOfWeek.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;

      weeklyMap[weekStr] = weeklyMap[weekStr] || { label: weekStr, trainees: 0, sessions: 0, timestamp: startOfWeek.getTime() };
      weeklyMap[weekStr].trainees += count;
      weeklyMap[weekStr].sessions += 1;

      // Monthly Grouping
      const monthTimestamp = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      monthlyMap[monthStr] = monthlyMap[monthStr] || { label: monthStr, trainees: 0, sessions: 0, timestamp: monthTimestamp };
      monthlyMap[monthStr].trainees += count;
      monthlyMap[monthStr].sessions += 1;

      if (monthlyMap[monthStr].trainees > peakMonth.count) {
        peakMonth = { month: fullMonthStr, count: monthlyMap[monthStr].trainees };
      }
    });

    const dailyChart = Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-25);
    const weeklyChart = Object.values(weeklyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-12);
    const monthlyChart = Object.values(monthlyMap).sort((a, b) => a.timestamp - b.timestamp);
    const platformPieData = Object.entries(platformMap).map(([name, value]) => ({ name, value }));

    return { dailyChart, weeklyChart, monthlyChart, platformPieData, peakDay, peakMonth };
  }, [opsData, startDate, endDate, selectedMonth]);

  // ─── 5. Google Calendar Events Multi-Chart Analytics ───────
  const calendarAnalytics = useMemo(() => {
    const sessions: any[] = opsData?.sessions || [];
    const jsSessions: any[] = jobSupportData?.sessions || [];

    const allEvents = [
      ...sessions.map((s) => ({ ...s, eventType: 'Training Session' })),
      ...jsSessions.map((s) => ({ ...s, eventType: '1-on-1 Support Standup' })),
    ].filter((e) => filterByTimeRange(e.date || new Date()));

    const dailyMap: Record<string, { label: string; events: number; timestamp: number }> = {};
    const weeklyMap: Record<string, { label: string; events: number; timestamp: number }> = {};
    const monthlyMap: Record<string, { label: string; events: number; timestamp: number }> = {};
    const typeMap: Record<string, number> = {};

    let peakDay = { date: 'N/A', count: 0 };
    let peakMonth = { month: 'N/A', count: 0 };

    allEvents.forEach((e) => {
      const d = new Date(e.date || new Date());
      const dayStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const monthStr = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      const fullMonthStr = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      const et = e.eventType || 'Ops Event';
      typeMap[et] = (typeMap[et] || 0) + 1;

      // Daily Grouping
      const dayTimestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      dailyMap[dayStr] = dailyMap[dayStr] || { label: dayStr, events: 0, timestamp: dayTimestamp };
      dailyMap[dayStr].events += 1;

      if (dailyMap[dayStr].events > peakDay.count) {
        peakDay = { date: dayStr, count: dailyMap[dayStr].events };
      }

      // Weekly Grouping
      const startOfWeek = new Date(d);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekStr = `Wk of ${startOfWeek.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;

      weeklyMap[weekStr] = weeklyMap[weekStr] || { label: weekStr, events: 0, timestamp: startOfWeek.getTime() };
      weeklyMap[weekStr].events += 1;

      // Monthly Grouping
      const monthTimestamp = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      monthlyMap[monthStr] = monthlyMap[monthStr] || { label: monthStr, events: 0, timestamp: monthTimestamp };
      monthlyMap[monthStr].events += 1;

      if (monthlyMap[monthStr].events > peakMonth.count) {
        peakMonth = { month: fullMonthStr, count: monthlyMap[monthStr].events };
      }
    });

    const dailyChart = Object.values(dailyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-25);
    const weeklyChart = Object.values(weeklyMap).sort((a, b) => a.timestamp - b.timestamp).slice(-12);
    const monthlyChart = Object.values(monthlyMap).sort((a, b) => a.timestamp - b.timestamp);
    const typePieData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

    return { dailyChart, weeklyChart, monthlyChart, typePieData, peakDay, peakMonth };
  }, [opsData, jobSupportData, startDate, endDate, selectedMonth]);

  // Helper for component timeframe data selection
  const getComponentData = (analyticsObj: any, frame: TimeFrame) => {
    if (frame === 'monthly') return analyticsObj?.monthlyChart || [];
    if (frame === 'weekly') return analyticsObj?.weeklyChart || [];
    return analyticsObj?.dailyChart || [];
  };

  // Helper for dynamic peak highlight badge text based on active timeframe toggle (Daily / Weekly / Monthly)
  const getPeakHighlight = (
    analyticsObj: any,
    frame: TimeFrame,
    metricKey: string,
    isCurrency: boolean = false,
    unit: string = ''
  ) => {
    if (!analyticsObj) return 'N/A';

    let dataset: any[] = [];
    let prefix = 'Peak Day';

    if (frame === 'daily') {
      dataset = analyticsObj.dailyChart || [];
      prefix = 'Peak Day';
    } else if (frame === 'weekly') {
      dataset = analyticsObj.weeklyChart || [];
      prefix = 'Peak Week';
    } else {
      dataset = analyticsObj.monthlyChart || [];
      prefix = 'Peak Month';
    }

    if (!dataset || dataset.length === 0) return `${prefix}: N/A`;

    let maxItem = dataset[0];
    let maxVal = Number(maxItem?.[metricKey] || 0);

    for (let i = 1; i < dataset.length; i++) {
      const val = Number(dataset[i]?.[metricKey] || 0);
      if (val > maxVal) {
        maxVal = val;
        maxItem = dataset[i];
      }
    }

    if (maxVal <= 0) return `${prefix}: N/A`;

    const valStr = isCurrency ? formatCurrency(maxVal) : `${maxVal} ${unit}`.trim();
    return `${prefix}: ${maxItem.label} (${valStr})`;
  };

  const resetAllFilters = () => {
    setSelectedMonth('all');
    setStartDate('');
    setEndDate('');
    setIsFilterPopoverOpen(false);
  };

  // Ratios for circular gauge cards (from reference image design)
  const financeMarginPct = useMemo(() => {
    const inc = financeData?.summary?.totalIncome || 1;
    const exp = financeData?.summary?.totalExpense || 0;
    const margin = inc - exp;
    return inc > 0 ? Math.round((margin / inc) * 100) : 36;
  }, [financeData]);

  const leadsProcessedPct = useMemo(() => {
    const enquiries: any[] = commsData?.enquiries || [];
    if (enquiries.length === 0) return 80;
    const processed = enquiries.filter(e => e.status === 'Processed' || e.status === 'Resolved' || e.status === 'Converted').length;
    return Math.round((processed / enquiries.length) * 100);
  }, [commsData]);

  const jobSupportPaidPct = useMemo(() => {
    const sessions: any[] = jobSupportData?.sessions || [];
    if (sessions.length === 0) return 75;
    let totalDue = 0, totalPaid = 0;
    sessions.forEach(s => {
      if (Array.isArray(s.participants)) {
        s.participants.forEach((p: any) => {
          totalDue += p.amountDue || 0;
          totalPaid += p.amountPaid || 0;
        });
      }
    });
    return totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 65;
  }, [jobSupportData]);

  return (
    <div className="min-h-screen bg-[#070a12] text-white p-3 sm:p-6 md:p-8 space-y-5 sm:space-y-7">
      {/* Top Header & Navigation - Sleek Matte UI */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0e1422] border border-white/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between w-full lg:w-auto gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="/"
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-900 border border-white/15 hover:bg-slate-800 transition-colors text-slate-300 hover:text-white shrink-0"
              title="Return to Dashboard"
            >
              <ArrowLeft size={18} />
            </a>

            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-lime-400 via-emerald-500 to-violet-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-lime-500/20 shrink-0">
              <BarChart3 size={22} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-2xl font-black text-white tracking-tight">
                  Ops Peak Analytics & Trend Intelligence
                </h1>
                <span className="bg-lime-400/20 text-lime-300 border border-lime-400/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
                  Sleek Dark Matte Suite
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Custom Multi-Chart Dashboards with Circular Gauge Rings, Neon Bars & Independent Timeframe Controls
              </p>
            </div>
          </div>

          <div className="lg:hidden shrink-0">
            <NavDrawerButton className="!w-9 !h-9" />
          </div>
        </div>

        {/* Global Filter & Custom Date Range Popover Button */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Floating Filter Popover Button */}
          <div className="relative">
            <button
              onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                selectedMonth !== 'all' || startDate || endDate
                  ? 'bg-lime-500/20 border-lime-500/50 text-lime-300 shadow-md shadow-lime-500/10'
                  : 'bg-slate-900 border-white/15 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Customize Date Range & Month Filter"
            >
              <Calendar size={15} className={selectedMonth !== 'all' || startDate || endDate ? 'text-lime-400' : 'text-slate-400'} />
              <span>
                {selectedMonth !== 'all'
                  ? `Month: ${selectedMonth.toUpperCase()}`
                  : startDate || endDate
                  ? `${startDate || 'Start'} → ${endDate || 'End'}`
                  : 'Custom Time Range Filter'}
              </span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterPopoverOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Custom Filter Popover Menu */}
            {isFilterPopoverOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterPopoverOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-80 p-4 rounded-2xl bg-[#0e1422] border border-white/20 shadow-2xl backdrop-blur-2xl animate-fade-in space-y-4 text-white">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <Filter size={14} className="text-lime-400" /> Time Range & Month Filter
                    </span>
                    <button onClick={() => setIsFilterPopoverOpen(false)} className="text-slate-400 hover:text-white">
                      <X size={15} />
                    </button>
                  </div>

                  {/* Month Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Select Month</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        'all', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
                      ].map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            setSelectedMonth(m);
                            setStartDate('');
                            setEndDate('');
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold uppercase text-center transition-all cursor-pointer ${
                            selectedMonth === m
                              ? 'bg-lime-500/25 border border-lime-500/50 text-lime-300 font-black'
                              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Start / End Date */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Custom Date Picker</span>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 shrink-0">From:</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            setSelectedMonth('all');
                          }}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-lime-500 w-full"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 shrink-0">To:</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => {
                            setEndDate(e.target.value);
                            setSelectedMonth('all');
                          }}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-lime-500 w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reset & Apply */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <button
                      onClick={resetAllFilters}
                      className="text-slate-400 hover:text-rose-400 font-bold transition-colors cursor-pointer"
                    >
                      Reset All
                    </button>
                    <button
                      onClick={() => setIsFilterPopoverOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-black transition-all cursor-pointer shadow-md"
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={fetchAllAnalytics}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-white/15 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
            title="Refresh All Analytics"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>

          <div className="hidden lg:block shrink-0">
            <NavDrawerButton />
          </div>
        </div>
      </div>

      {/* Sleek Circular Gauge Arc Scorecards (Directly Modeled on Reference UI Design!) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <CircularGauge
          value={financeMarginPct}
          label="Net Profit Margin"
          subtext={formatCurrency(financeData?.summary?.netProfit || 422926)}
          color={NEON_COLORS.lime}
        />
        <CircularGauge
          value={leadsProcessedPct}
          label="Leads Conversion Rate"
          subtext={`${commsData?.summary?.total || 398} Total Leads`}
          color={NEON_COLORS.cyan}
        />
        <CircularGauge
          value={jobSupportPaidPct}
          label="Job Support Client Payments"
          subtext={`${jobSupportData?.sessions?.length || 4} Engagements`}
          color={NEON_COLORS.amber}
        />
        <CircularGauge
          value={88}
          label="Training Batch Capacity"
          subtext={`${opsData?.summary?.totalParticipants || 125} Enrolled Trainees`}
          color={NEON_COLORS.purple}
        />
      </div>

      {/* ─── MODULE 1: Finance Intelligence (Dual Chart Grid) ──── */}
      <div className="bg-[#0e1422] border border-white/10 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/20 border border-lime-500/40 text-lime-400 flex items-center justify-center font-bold">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                1. Finance Intelligence — Multi-Chart Visualization
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Pill Bar Revenue Flow + Category Doughnut Breakdown with Values
              </p>
            </div>
          </div>

          {/* Component Timeframe Toggle Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-slate-900 border border-white/15 rounded-xl gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setFinanceFrame(tf)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold capitalize transition-all cursor-pointer ${
                    financeFrame === tf
                      ? 'bg-lime-500 text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="w-[240px] min-w-[240px] px-3 py-1.5 rounded-xl bg-lime-500/10 border border-lime-500/30 text-lime-300 text-xs font-bold font-mono text-center justify-center shrink-0 hidden md:flex">
              {getPeakHighlight(financeAnalytics, financeFrame, 'income', true)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1A: Pill Bar Flow */}
          <div className="lg:col-span-2 space-y-2">
            <span className="text-xs font-black text-slate-300 block uppercase tracking-wider">
              Credit & Debit Sequence ({financeFrame})
            </span>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getComponentData(financeAnalytics, financeFrame)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2438" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip content={<CustomChartTooltip unit="" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Bar dataKey="income" name="Income (Credit)" fill={NEON_COLORS.lime} radius={[8, 8, 8, 8]} maxBarSize={36} />
                  <Bar dataKey="expense" name="Expense (Debit)" fill={NEON_COLORS.purple} radius={[8, 8, 8, 8]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 1B: Concentric Radial Arc Graph */}
          <div className="space-y-2">
            <ConcentricRadialArcGraph
              title="Category Distribution"
              data={financeAnalytics.categoryPieData}
              totalLabel="TOTAL VOL"
              isCurrency={true}
              hideCenterText={true}
            />
          </div>
        </div>
      </div>

      {/* ─── MODULE 2: Leads (LINE GRAPH SUITE) ────────────────── */}
      <div className="bg-[#0e1422] border border-white/10 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                2. Leads — Multi-Chart Visualization
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Dual Chart Grid: Neon Lime/Cyan Line Curve + Lead Status Breakdown
              </p>
            </div>
          </div>

          {/* Component Timeframe Toggle Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-slate-900 border border-white/15 rounded-xl gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setLeadsFrame(tf)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold capitalize transition-all cursor-pointer ${
                    leadsFrame === tf
                      ? 'bg-cyan-400 text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="w-[240px] min-w-[240px] px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold font-mono text-center justify-center shrink-0 hidden md:flex">
              {getPeakHighlight(leadsAnalytics, leadsFrame, 'count', false, 'Leads')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 2A: Line Chart Flow */}
          <div className="lg:col-span-2 space-y-2">
            <span className="text-xs font-black text-slate-300 block uppercase tracking-wider">
              Leads Intake Line Flow ({leadsFrame})
            </span>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={getComponentData(leadsAnalytics, leadsFrame)}>
                  <defs>
                    <linearGradient id="leadsLineGradMatte" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={NEON_COLORS.cyan} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={NEON_COLORS.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2438" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip content={<CustomChartTooltip unit="Leads" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="count" name="Leads Received" stroke={NEON_COLORS.cyan} strokeWidth={3} fill="url(#leadsLineGradMatte)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2B: Concentric Radial Arc Graph */}
          <div className="space-y-2">
            <ConcentricRadialArcGraph
              title="Lead Status Breakdown"
              data={leadsAnalytics.statusPieData}
              totalLabel="TOTAL LEADS"
              isCurrency={false}
              unit="Leads"
            />
          </div>
        </div>
      </div>

      {/* ─── MODULE 3: Job Support Operations (Multi-Chart Grid) ── */}
      <div className="bg-[#0e1422] border border-white/10 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                3. Job Support Operations — Multi-Chart Visualization
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Dual Chart Grid: 1-on-1 Support Starts Pill Bar Chart + Tech Stack Platform Doughnut
              </p>
            </div>
          </div>

          {/* Component Timeframe Toggle Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-slate-900 border border-white/15 rounded-xl gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setJobSupportFrame(tf)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold capitalize transition-all cursor-pointer ${
                    jobSupportFrame === tf
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="w-[240px] min-w-[240px] px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono text-center justify-center shrink-0 hidden md:flex">
              {getPeakHighlight(jobSupportAnalytics, jobSupportFrame, 'count', false, 'Starts')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 3A: Bar Chart */}
          <div className="lg:col-span-2 space-y-2">
            <span className="text-xs font-black text-slate-300 block uppercase tracking-wider">
              Support Starts Sequence ({jobSupportFrame})
            </span>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getComponentData(jobSupportAnalytics, jobSupportFrame)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2438" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip content={<CustomChartTooltip unit="Starts" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Bar dataKey="count" name="Support Sessions Started" fill={NEON_COLORS.amber} radius={[8, 8, 8, 8]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3B: Concentric Radial Arc Graph */}
          <div className="space-y-2">
            <ConcentricRadialArcGraph
              title="Tech Platform Distribution"
              data={jobSupportAnalytics.platformPieData}
              totalLabel="TOTAL SESSIONS"
              isCurrency={false}
              unit="Sessions"
            />
          </div>
        </div>
      </div>

      {/* ─── MODULE 4: Training Operations (Multi-Chart Grid) ─── */}
      <div className="bg-[#0e1422] border border-white/10 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                4. Training Operations & Trainees — Multi-Chart Visualization
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Dual Chart Grid: Trainees vs Sessions Pill Bar Chart + SCM Platform Doughnut
              </p>
            </div>
          </div>

          {/* Component Timeframe Toggle Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-slate-900 border border-white/15 rounded-xl gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setOpsFrame(tf)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold capitalize transition-all cursor-pointer ${
                    opsFrame === tf
                      ? 'bg-purple-500 text-white font-black shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="w-[240px] min-w-[240px] px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold font-mono text-center justify-center shrink-0 hidden md:flex">
              {getPeakHighlight(opsAnalyticsData, opsFrame, 'trainees', false, 'Trainees')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 4A: Trainees & Sessions Bar */}
          <div className="lg:col-span-2 space-y-2">
            <span className="text-xs font-black text-slate-300 block uppercase tracking-wider">
              Trainees Enrolled & Sessions ({opsFrame})
            </span>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getComponentData(opsAnalyticsData, opsFrame)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2438" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip content={<CustomChartTooltip unit="" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Bar dataKey="trainees" name="Trainees Enrolled" fill={NEON_COLORS.purple} radius={[8, 8, 8, 8]} maxBarSize={36} />
                  <Bar dataKey="sessions" name="Sessions Held" fill={NEON_COLORS.lime} radius={[8, 8, 8, 8]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4B: Concentric Radial Arc Graph */}
          <div className="space-y-2">
            <ConcentricRadialArcGraph
              title="SCM Platform Allocation"
              data={opsAnalyticsData.platformPieData}
              totalLabel="TOTAL TRAINEES"
              isCurrency={false}
              unit="Trainees"
            />
          </div>
        </div>
      </div>

      {/* ─── MODULE 5: Google Calendar Events (Multi-Chart Grid) ── */}
      <div className="bg-[#0e1422] border border-white/10 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center font-bold">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                5. Google Calendar Events & Schedules — Multi-Chart Visualization
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Dual Chart Grid: Schedule Density Pill Bar Chart + Event Category Doughnut Breakdown
              </p>
            </div>
          </div>

          {/* Component Timeframe Toggle Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-slate-900 border border-white/15 rounded-xl gap-1">
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setCalendarFrame(tf)}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold capitalize transition-all cursor-pointer ${
                    calendarFrame === tf
                      ? 'bg-purple-500 text-white font-black shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="w-[240px] min-w-[240px] px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono text-center justify-center shrink-0 hidden md:flex">
              {getPeakHighlight(calendarAnalytics, calendarFrame, 'events', false, 'Events')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 5A: Event Bar */}
          <div className="lg:col-span-2 space-y-2">
            <span className="text-xs font-black text-slate-300 block uppercase tracking-wider">
              Ops Schedule Density ({calendarFrame})
            </span>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getComponentData(calendarAnalytics, calendarFrame)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c2438" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip content={<CustomChartTooltip unit="Events" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Bar dataKey="events" name="Scheduled Events" fill={NEON_COLORS.purple} radius={[8, 8, 8, 8]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 5B: Concentric Radial Arc Graph */}
          <div className="space-y-2">
            <ConcentricRadialArcGraph
              title="Event Type Breakdown"
              data={calendarAnalytics.typePieData}
              totalLabel="TOTAL EVENTS"
              isCurrency={false}
              unit="Events"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
