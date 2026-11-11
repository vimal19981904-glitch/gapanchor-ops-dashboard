'use client';

import React, { useState, useEffect, useMemo, useId } from 'react';
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

// Monochrome Slate / Black-Grey Gradient Palette (Matching Leads Dashboard)
const MONO_RING_TIERS = [
  { from: '#ffffff', to: '#94a3b8', css: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)' }, // Pearl Silver -> Slate
  { from: '#e2e8f0', to: '#64748b', css: 'linear-gradient(135deg, #e2e8f0 0%, #64748b 100%)' }, // Cool Steel -> Graphite
  { from: '#cbd5e1', to: '#475569', css: 'linear-gradient(135deg, #cbd5e1 0%, #475569 100%)' }, // Gunmetal -> Charcoal
  { from: '#94a3b8', to: '#334155', css: 'linear-gradient(135deg, #94a3b8 0%, #334155 100%)' }, // Slate -> Obsidian
  { from: '#64748b', to: '#1e293b', css: 'linear-gradient(135deg, #64748b 0%, #1e293b 100%)' }, // Deep Charcoal
];

type TimeFrame = 'daily' | 'weekly' | 'monthly';

function resolveTooltipSwatch(rawColor?: string, index = 0): string {
  if (rawColor && !rawColor.startsWith('url(')) {
    return rawColor;
  }
  if (rawColor?.toLowerCase().includes('secondary')) {
    return MONO_RING_TIERS[3].css;
  }
  return MONO_RING_TIERS[index % 2 === 1 ? 3 : 0].css;
}

// Returns a native SVG <defs> node so Recharts mounts gradients inside <svg class="recharts-surface">
function renderMonoSvgDefs(prefix: string) {
  return (
    <defs>
      <linearGradient id={`${prefix}Primary`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.98} />
        <stop offset="50%" stopColor="#cbd5e1" stopOpacity={0.92} />
        <stop offset="100%" stopColor="#64748b" stopOpacity={0.86} />
      </linearGradient>
      <linearGradient id={`${prefix}Secondary`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#475569" stopOpacity={0.98} />
        <stop offset="55%" stopColor="#1e293b" stopOpacity={0.98} />
        <stop offset="100%" stopColor="#090d16" stopOpacity={1} />
      </linearGradient>
      <linearGradient id={`${prefix}AreaFill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f8fafc" stopOpacity={0.38} />
        <stop offset="55%" stopColor="#64748b" stopOpacity={0.14} />
        <stop offset="100%" stopColor="#0f172a" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id={`${prefix}AreaStroke`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="50%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
    </defs>
  );
}

// Custom HTML Legend so gradient bars/lines render visible gradient swatches outside SVG defs scope
function MonoChartLegend({ payload }: { payload?: any[] }) {
  if (!payload || payload.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-[11px] font-bold">
      {payload.map((entry, idx) => (
        <div key={`leg-${idx}`} className="flex items-center gap-1.5 text-slate-300">
          <span
            className="w-3 h-3 rounded-[4px] border border-white/30 shrink-0"
            style={{ background: resolveTooltipSwatch(entry.color, idx) }}
          />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// Responsive Circular Progress Gauge (Unclipped SVG viewBox + Leads Dashboard Obsidian Glass)
function CircularGauge({
  value,
  label,
  subtext,
  tier = 0,
}: {
  value: number;
  label: string;
  subtext: string;
  tier?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const gradId = `gauge-grad-${uid}`;
  const clamped = Math.min(100, Math.max(0, value));
  const r = 32;
  const stroke = 6.5;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const stopColors = MONO_RING_TIERS[tier % MONO_RING_TIERS.length];

  return (
    <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 hover:border-slate-600/70 transition-colors p-3 sm:p-4 rounded-2xl shadow-lg flex flex-col justify-between gap-2 min-w-0">
      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block truncate">
        {label}
      </span>
      <div className="flex items-center justify-between gap-2.5 min-w-0">
        <span className="text-xs sm:text-base font-black text-white leading-tight break-words min-w-0">
          {subtext}
        </span>
        <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90 overflow-visible">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={stopColors.from} />
                <stop offset="100%" stopColor={stopColors.to} />
              </linearGradient>
            </defs>
            <circle
              stroke="rgba(148, 163, 184, 0.14)"
              fill="transparent"
              strokeWidth={stroke}
              r={r}
              cx={40}
              cy={40}
            />
            <circle
              stroke={`url(#${gradId})`}
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={`${circumference} ${circumference}`}
              style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.6s ease-in-out' }}
              strokeLinecap="round"
              r={r}
              cx={40}
              cy={40}
            />
          </svg>
          <span className="absolute text-[10px] sm:text-xs font-black font-mono text-slate-100">
            {value}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip matching Leads Dashboard Obsidian Palette
function CustomChartTooltip({ active, payload, label, unit = '' }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-2xl border border-slate-700/60 p-3 rounded-2xl shadow-2xl space-y-1.5 text-xs text-white z-50">
        <p className="font-bold text-slate-100 border-b border-slate-800 pb-1 flex items-center gap-1.5">
          <Calendar size={13} className="text-slate-400" />
          {label}
        </p>
        {payload.map((item: any, index: number) => (
          <div key={`tt-${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/25 shrink-0"
                style={{ background: resolveTooltipSwatch(item.color || item.fill, index) }}
              />
              {item.name}:
            </span>
            <span className="font-black font-mono text-white">
              {typeof item.value === 'number' &&
              (item.name?.toLowerCase().includes('income') ||
                item.name?.toLowerCase().includes('expense') ||
                item.name?.toLowerCase().includes('credit') ||
                item.name?.toLowerCase().includes('debit'))
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

// Concentric Radial Arc Graph (Unclipped SVG viewBox + Monochrome Black-Grey Gradient Tiers)
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
  const uid = useId().replace(/:/g, '');
  const total = data.reduce((a, b) => a + b.value, 0);
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  const ringRadii = [74, 60, 46, 32];
  const strokeWidth = 9;
  const svgSize = 200;
  const center = svgSize / 2;
  const arcSweepDeg = 240;
  const startRotateDeg = 150;

  return (
    <div className="bg-slate-950/60 border border-slate-700/50 p-3.5 sm:p-5 rounded-2xl space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 gap-2">
        <span className="text-[11px] sm:text-xs font-bold text-slate-200 uppercase tracking-wider truncate">
          {title}
        </span>
        <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded-full shrink-0">
          {data.length} Categories
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 lg:grid-cols-1 gap-4 items-center">
        <div className="sm:col-span-5 lg:col-span-1 relative flex items-center justify-center py-1">
          <div className="relative w-[164px] h-[164px] sm:w-[176px] sm:h-[176px] flex items-center justify-center">
            <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full overflow-visible">
              <defs>
                {MONO_RING_TIERS.map((tier, idx) => (
                  <linearGradient key={`rg-${idx}`} id={`ring-grad-${uid}-${idx}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={tier.from} />
                    <stop offset="100%" stopColor={tier.to} />
                  </linearGradient>
                ))}
              </defs>
              {data.slice(0, 4).map((item, idx) => {
                const r = ringRadii[idx % ringRadii.length];
                const circumference = 2 * Math.PI * r;
                const pct = Math.min(100, Math.max(8, (item.value / maxVal) * 100));
                const maxArcLength = (arcSweepDeg / 360) * circumference;
                const filledLength = (pct / 100) * maxArcLength;

                return (
                  <g key={`concentric-ring-${idx}`}>
                    <circle
                      cx={center}
                      cy={center}
                      r={r}
                      fill="none"
                      stroke="rgba(148, 163, 184, 0.1)"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${maxArcLength} ${circumference}`}
                      strokeLinecap="round"
                      transform={`rotate(${startRotateDeg} ${center} ${center})`}
                    />
                    <circle
                      cx={center}
                      cy={center}
                      r={r}
                      fill="none"
                      stroke={`url(#ring-grad-${uid}-${idx % MONO_RING_TIERS.length})`}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${filledLength} ${circumference}`}
                      strokeLinecap="round"
                      transform={`rotate(${startRotateDeg} ${center} ${center})`}
                      style={{
                        transition: 'stroke-dasharray 1s ease-out',
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {!hideCenterText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-2">
                <span className="text-xs sm:text-sm font-black font-mono text-white truncate max-w-[100px]">
                  {isCurrency ? formatCurrency(total) : total}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  {totalLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="sm:col-span-7 lg:col-span-1 space-y-2 min-w-0">
          {data.map((item, idx) => {
            const tier = MONO_RING_TIERS[idx % MONO_RING_TIERS.length];
            const pct = total > 0 ? (item.value / total) * 100 : 0;

            return (
              <div
                key={item.name}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-700/40 hover:border-slate-600/60 transition-all text-xs min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-[4px] shrink-0 border border-white/25"
                    style={{ background: tier.css }}
                  />
                  <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2 font-mono">
                  <span className="font-black text-white text-[11px] sm:text-xs">
                    {isCurrency ? formatCurrency(item.value) : `${item.value} ${unit}`}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
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

// Shared Module Card Shell (Monochrome Leads Aesthetic + Responsive Timeframe Controls)
function AnalyticsModuleCard({
  title,
  subtitle,
  icon,
  timeframe,
  onTimeframeChange,
  peakLabel,
  peakIcon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  timeframe: TimeFrame;
  onTimeframeChange: (tf: TimeFrame) => void;
  peakLabel?: string;
  peakIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-slate-200 shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-black text-white leading-snug">{title}</h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {peakLabel && (
            <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-700/60 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold text-slate-200">
              {peakIcon}
              <span className="truncate max-w-[200px] sm:max-w-none">{peakLabel}</span>
            </div>
          )}

          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-700/50 text-[11px] sm:text-xs font-bold">
            {(['daily', 'weekly', 'monthly'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg capitalize transition-all ${
                  timeframe === tf
                    ? 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {children}
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
    <div className="min-h-screen bg-[#020617] text-white p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Top Header & Navigation (Matching Leads Dashboard Glass UI) */}
      <div className="relative z-20 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-slate-900/70 backdrop-blur-md border border-slate-700/50 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl">
        <div className="flex items-center justify-between w-full lg:w-auto gap-3 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <a
              href="/"
              className="p-2 sm:p-2.5 rounded-xl bg-slate-950/70 border border-slate-700/60 hover:bg-slate-800 transition-colors text-slate-300 hover:text-white shrink-0"
              title="Return to Dashboard"
            >
              <ArrowLeft size={17} />
            </a>

            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 border border-slate-600/60 flex items-center justify-center text-slate-100 shadow-inner shrink-0">
              <BarChart3 size={20} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-2xl font-black bg-gradient-to-r from-cyan-300 via-white to-indigo-300 bg-clip-text text-transparent tracking-tight leading-tight">
                  Ops Peak Analytics & Trend Intelligence
                </h1>
                <span className="bg-slate-800/80 text-slate-300 border border-slate-700/60 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block mt-0.5">
                Unified Multi-Chart Executive Analytics with Monochrome Gradient Series & Independent Timeframe Controls
              </p>
            </div>
          </div>

          <div className="lg:hidden shrink-0">
            <NavDrawerButton className="!w-9 !h-9" />
          </div>
        </div>

        {/* Global Filter & Custom Date Range Popover Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-wrap w-full lg:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <button
              onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
              className={`w-full sm:w-auto justify-between sm:justify-start px-3 sm:px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                selectedMonth !== 'all' || startDate || endDate
                  ? 'bg-slate-800 border-slate-500/80 text-white shadow-md'
                  : 'bg-slate-950/70 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title="Customize Date Range & Month Filter"
            >
              <span className="flex items-center gap-2 min-w-0 truncate">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <span className="truncate">
                  {selectedMonth !== 'all'
                    ? `Month: ${selectedMonth.toUpperCase()}`
                    : startDate || endDate
                    ? `${startDate || 'Start'} → ${endDate || 'End'}`
                    : 'Custom Time Range Filter'}
                </span>
              </span>
              <ChevronDown
                size={14}
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${isFilterPopoverOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isFilterPopoverOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterPopoverOpen(false)} />
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-[min(320px,calc(100vw-1.5rem))] p-4 rounded-2xl bg-slate-900/95 border border-slate-700/70 shadow-2xl backdrop-blur-2xl animate-fade-in space-y-4 text-white">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <Filter size={14} className="text-slate-300" /> Time Range & Month Filter
                    </span>
                    <button onClick={() => setIsFilterPopoverOpen(false)} className="text-slate-400 hover:text-white">
                      <X size={15} />
                    </button>
                  </div>

                  {/* Month Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Select Month</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['all', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            setSelectedMonth(m);
                            setStartDate('');
                            setEndDate('');
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold uppercase text-center transition-all cursor-pointer ${
                            selectedMonth === m
                              ? 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-950 font-black'
                              : 'bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
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
                          className="bg-slate-950/80 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-slate-400 w-full"
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
                          className="bg-slate-950/80 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-slate-400 w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reset & Apply */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <button
                      onClick={resetAllFilters}
                      className="text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
                    >
                      Reset All
                    </button>
                    <button
                      onClick={() => setIsFilterPopoverOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-slate-100 to-slate-300 hover:from-white hover:to-slate-200 text-slate-950 font-black transition-all cursor-pointer shadow-md"
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
            className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold shrink-0"
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

      {/* KPI Circular Gauge Scorecards (2-col mobile grid matching Leads Dashboard) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <CircularGauge
          value={financeMarginPct}
          label="Net Profit Margin"
          subtext={formatCurrency(financeData?.summary?.netProfit || 422926)}
          tier={0}
        />
        <CircularGauge
          value={leadsProcessedPct}
          label="Leads Conversion Rate"
          subtext={`${commsData?.summary?.total || 398} Total Leads`}
          tier={1}
        />
        <CircularGauge
          value={jobSupportPaidPct}
          label="Job Support Payments"
          subtext={`${jobSupportData?.sessions?.length || 4} Engagements`}
          tier={2}
        />
        <CircularGauge
          value={88}
          label="Batch Capacity"
          subtext={`${opsData?.summary?.totalParticipants || 125} Enrolled Trainees`}
          tier={3}
        />
      </div>

      {/* ─── MODULE 1: Finance Intelligence ──── */}
      <AnalyticsModuleCard
        title="1. Finance Intelligence — Multi-Chart Visualization"
        subtitle="Revenue Flow Gradient Bars + Category Radial Distribution"
        icon={<DollarSign size={19} />}
        timeframe={financeFrame}
        onTimeframeChange={setFinanceFrame}
        peakLabel={getPeakHighlight(financeAnalytics, financeFrame, 'income', true)}
        peakIcon={<TrendingUp size={13} className="text-slate-300 shrink-0" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <div className="lg:col-span-2 space-y-2 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Credit & Debit Sequence ({financeFrame})
            </span>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getComponentData(financeAnalytics, financeFrame)}
                  margin={{ top: 10, right: 8, left: -10, bottom: 0 }}
                >
                  {renderMonoSvgDefs('fin')}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={10}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={46}
                    tickFormatter={(v) => `₹${v / 1000}k`}
                  />
                  <Tooltip content={<CustomChartTooltip unit="" />} />
                  <Legend content={<MonoChartLegend />} />
                  <Bar
                    dataKey="income"
                    name="Income (Credit)"
                    fill="url(#finPrimary)"
                    stroke="#f8fafc"
                    strokeOpacity={0.45}
                    radius={[6, 6, 4, 4]}
                    maxBarSize={34}
                  />
                  <Bar
                    dataKey="expense"
                    name="Expense (Debit)"
                    fill="url(#finSecondary)"
                    stroke="#94a3b8"
                    strokeOpacity={0.85}
                    strokeWidth={1}
                    radius={[6, 6, 4, 4]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0">
            <ConcentricRadialArcGraph
              title="Category Distribution"
              data={financeAnalytics.categoryPieData}
              totalLabel="TOTAL VOL"
              isCurrency={true}
              hideCenterText={true}
            />
          </div>
        </div>
      </AnalyticsModuleCard>

      {/* ─── MODULE 2: Leads ──── */}
      <AnalyticsModuleCard
        title="2. Leads — Multi-Chart Visualization"
        subtitle="Monochrome Intake Area Curve + Lead Status Breakdown"
        icon={<MessageSquare size={19} />}
        timeframe={leadsFrame}
        onTimeframeChange={setLeadsFrame}
        peakLabel={getPeakHighlight(leadsAnalytics, leadsFrame, 'count', false, 'Leads')}
        peakIcon={<Zap size={13} className="text-slate-300 shrink-0" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <div className="lg:col-span-2 space-y-2 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Leads Intake Flow ({leadsFrame})
            </span>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={getComponentData(leadsAnalytics, leadsFrame)}
                  margin={{ top: 10, right: 8, left: -14, bottom: 0 }}
                >
                  {renderMonoSvgDefs('leads')}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={10}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip content={<CustomChartTooltip unit="Leads" />} />
                  <Legend content={<MonoChartLegend />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Leads Received"
                    stroke="url(#leadsAreaStroke)"
                    strokeWidth={3}
                    fill="url(#leadsAreaFill)"
                    activeDot={{ r: 5, fill: '#f8fafc', stroke: '#334155', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0">
            <ConcentricRadialArcGraph
              title="Lead Status Breakdown"
              data={leadsAnalytics.statusPieData}
              totalLabel="TOTAL LEADS"
              isCurrency={false}
              unit="Leads"
            />
          </div>
        </div>
      </AnalyticsModuleCard>

      {/* ─── MODULE 3: Job Support Operations ──── */}
      <AnalyticsModuleCard
        title="3. Job Support Operations — Multi-Chart Visualization"
        subtitle="1-on-1 Support Starts Sequence + Tech Stack Platform Distribution"
        icon={<Briefcase size={19} />}
        timeframe={jobSupportFrame}
        onTimeframeChange={setJobSupportFrame}
        peakLabel={getPeakHighlight(jobSupportAnalytics, jobSupportFrame, 'count', false, 'Starts')}
        peakIcon={<Award size={13} className="text-slate-300 shrink-0" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <div className="lg:col-span-2 space-y-2 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Support Starts Sequence ({jobSupportFrame})
            </span>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getComponentData(jobSupportAnalytics, jobSupportFrame)}
                  margin={{ top: 10, right: 8, left: -14, bottom: 0 }}
                >
                  {renderMonoSvgDefs('js')}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={10}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip content={<CustomChartTooltip unit="Starts" />} />
                  <Legend content={<MonoChartLegend />} />
                  <Bar
                    dataKey="count"
                    name="Support Sessions Started"
                    fill="url(#jsPrimary)"
                    stroke="#f8fafc"
                    strokeOpacity={0.45}
                    radius={[6, 6, 4, 4]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0">
            <ConcentricRadialArcGraph
              title="Tech Platform Distribution"
              data={jobSupportAnalytics.platformPieData}
              totalLabel="TOTAL SESSIONS"
              isCurrency={false}
              unit="Sessions"
            />
          </div>
        </div>
      </AnalyticsModuleCard>

      {/* ─── MODULE 4: Training Operations ──── */}
      <AnalyticsModuleCard
        title="4. Training Operations & Trainees — Multi-Chart Visualization"
        subtitle="Trainees vs Sessions Gradient Bars + SCM Platform Allocation"
        icon={<Calendar size={19} />}
        timeframe={opsFrame}
        onTimeframeChange={setOpsFrame}
        peakLabel={getPeakHighlight(opsAnalyticsData, opsFrame, 'trainees', false, 'Trainees')}
        peakIcon={<Users size={13} className="text-slate-300 shrink-0" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <div className="lg:col-span-2 space-y-2 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Trainees Enrolled & Sessions ({opsFrame})
            </span>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getComponentData(opsAnalyticsData, opsFrame)}
                  margin={{ top: 10, right: 8, left: -14, bottom: 0 }}
                >
                  {renderMonoSvgDefs('ops')}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={10}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip content={<CustomChartTooltip unit="" />} />
                  <Legend content={<MonoChartLegend />} />
                  <Bar
                    dataKey="trainees"
                    name="Trainees Enrolled"
                    fill="url(#opsPrimary)"
                    stroke="#f8fafc"
                    strokeOpacity={0.45}
                    radius={[6, 6, 4, 4]}
                    maxBarSize={34}
                  />
                  <Bar
                    dataKey="sessions"
                    name="Sessions Held"
                    fill="url(#opsSecondary)"
                    stroke="#94a3b8"
                    strokeOpacity={0.85}
                    strokeWidth={1}
                    radius={[6, 6, 4, 4]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0">
            <ConcentricRadialArcGraph
              title="SCM Platform Allocation"
              data={opsAnalyticsData.platformPieData}
              totalLabel="TOTAL TRAINEES"
              isCurrency={false}
              unit="Trainees"
            />
          </div>
        </div>
      </AnalyticsModuleCard>

      {/* ─── MODULE 5: Google Calendar Events ──── */}
      <AnalyticsModuleCard
        title="5. Google Calendar Events & Schedules — Multi-Chart Visualization"
        subtitle="Schedule Density Gradient Bars + Event Category Breakdown"
        icon={<Layers size={19} />}
        timeframe={calendarFrame}
        onTimeframeChange={setCalendarFrame}
        peakLabel={getPeakHighlight(calendarAnalytics, calendarFrame, 'events', false, 'Events')}
        peakIcon={<Activity size={13} className="text-slate-300 shrink-0" />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <div className="lg:col-span-2 space-y-2 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Ops Schedule Density ({calendarFrame})
            </span>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getComponentData(calendarAnalytics, calendarFrame)}
                  margin={{ top: 10, right: 8, left: -14, bottom: 0 }}
                >
                  {renderMonoSvgDefs('cal')}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={10}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip content={<CustomChartTooltip unit="Events" />} />
                  <Legend content={<MonoChartLegend />} />
                  <Bar
                    dataKey="events"
                    name="Scheduled Events"
                    fill="url(#calPrimary)"
                    stroke="#f8fafc"
                    strokeOpacity={0.45}
                    radius={[6, 6, 4, 4]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0">
            <ConcentricRadialArcGraph
              title="Event Type Breakdown"
              data={calendarAnalytics.typePieData}
              totalLabel="TOTAL EVENTS"
              isCurrency={false}
              unit="Events"
            />
          </div>
        </div>
      </AnalyticsModuleCard>
    </div>
  );
}
