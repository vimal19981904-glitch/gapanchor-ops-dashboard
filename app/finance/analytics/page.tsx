'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  DollarSign, ArrowLeft, RefreshCw, Upload, FileSpreadsheet, Download, Filter, Search, Calendar,
  TrendingUp, TrendingDown, PieChart as PieChartIcon, BarChart3, LineChart as LineChartIcon,
  CheckCircle, AlertTriangle, Eye, Trash2, X, PlusCircle, Layers, ShieldCheck, Tag, Info, Loader2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import ExpenseBreakdownDashboard from '@/components/Finance/ExpenseBreakdownDashboard';
import IncomeBreakdownDashboard from '@/components/Finance/IncomeBreakdownDashboard';
import AddCollectionModal from '@/components/Finance/AddCollectionModal';
import SessionFinanceBarChart from '@/components/Finance/SessionFinanceBarChart';


const CHART_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#3b82f6'];
const EXPENSE_CATEGORIES = ['Salary', 'Operation Cost', 'Software', 'Marketing', 'Infrastructure', 'Ops & Venue Logistics'];
const INCOME_CATEGORIES = ['Training Fees', 'Consulting & Projects', 'Member Payments', 'Enterprise Solutions', 'Other Revenue'];
const PAYMENT_METHODS = ['UPI', 'Bank Transfer', 'Credit Card', 'Cash', 'IMPS', 'NEFT'];

function formatParticularsAndRef(notes: string | null) {
  if (!notes) return { primary: 'Direct Statement Entry', secondary: 'Bank Transfer', refNo: '', raw: '' };

  const str = notes.trim();
  const refMatch = str.match(/\[Ref:\s*([^\]]+)\]/i);
  const refNo = refMatch ? refMatch[1] : '';
  const cleanStr = str.replace(/\[Ref:[^\]]+\]/gi, '').trim();

  const parts = cleanStr.split('/').map(p => p.trim()).filter(Boolean);

  let mode = '';
  let direction = '';
  let entity = '';

  if (parts.length > 0 && ['UPI', 'IMPS', 'NEFT', 'RTGS', 'FT', 'ACH', 'CARD'].includes(parts[0].toUpperCase())) {
    mode = parts[0].toUpperCase();
  }

  const drCrIdx = parts.findIndex(p => p.toUpperCase() === 'DR' || p.toUpperCase() === 'CR');
  if (drCrIdx !== -1) {
    direction = parts[drCrIdx].toUpperCase();
    if (parts[drCrIdx + 1]) {
      entity = parts[drCrIdx + 1];
    }
  }

  if (!entity) {
    if (parts.length >= 3) {
      entity = parts[2];
    } else if (parts.length === 2) {
      entity = parts[1];
    } else {
      entity = cleanStr;
    }
  }

  if (entity.toLowerCase().includes('dummy name')) {
    entity = 'Corporate Vendor / Transfer';
  }

  const bankNames = ['HDFC', 'SBI', 'IOB', 'ICICI', 'AXIS', 'UTI', 'KOTAK', 'PNB', 'BOB'];
  const foundBank = parts.find(p => bankNames.some(b => p.toUpperCase().includes(b)));

  const secondaryParts = [
    mode || 'Bank Transfer',
    direction ? (direction === 'CR' ? 'Credit' : 'Debit') : '',
    foundBank ? foundBank.toUpperCase() : '',
  ].filter(Boolean);

  return {
    primary: entity || cleanStr,
    secondary: secondaryParts.join(' • '),
    refNo: refNo ? `#${refNo}` : '',
    raw: str,
  };
}

export default function FinanceAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Filters & Controls
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [breakdownView, setBreakdownView] = useState<'combined' | 'income' | 'expense'>('combined');
  const [timelineGranularity, setTimelineGranularity] = useState<'hourly' | 'day' | 'weekly'>('day');
  const [timelinePreset, setTimelinePreset] = useState<string>('all');
  const [timelineStartDate, setTimelineStartDate] = useState<string>('');
  const [timelineEndDate, setTimelineEndDate] = useState<string>('');
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleTimelinePresetChange = (preset: string) => {
    setTimelinePreset(preset);
    if (preset === 'all') {
      setTimelineStartDate('');
      setTimelineEndDate('');
    } else if (preset === 'jun') {
      setTimelineStartDate('2026-06-01');
      setTimelineEndDate('2026-06-30');
    } else if (preset === 'jul') {
      setTimelineStartDate('2026-07-01');
      setTimelineEndDate('2026-07-31');
    } else if (preset === 'aug') {
      setTimelineStartDate('2026-08-01');
      setTimelineEndDate('2026-08-31');
    } else if (preset === 'sep') {
      setTimelineStartDate('2026-09-01');
      setTimelineEndDate('2026-09-30');
    }
  };

  // Selected Transaction for Detail / Categorization
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingTx, setDeletingTx] = useState(false);
  const [isAddCollectionModalOpen, setIsAddCollectionModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        toast.error(json.error || 'Failed to load finance data');
      }
    } catch (err: any) {
      toast.error('Network error loading finance analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  // Quick Sync Pre-Loaded Statement (Account_Statement.xlsx)
  const handleQuickSyncStatement = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/finance/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: 'C:\\Users\\ARUL XAVIER\\OneDrive - gapanchor\\dashboard\\Account_Statement.xlsx' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        fetchFinanceData();
      } else {
        toast.error(json.error || 'Failed to sync statement');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error syncing statement file');
    } finally {
      setSyncing(false);
    }
  };

  // Custom File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/finance/import', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        fetchFinanceData();
      } else {
        toast.error(json.error || 'Failed to import Excel file');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error uploading Excel file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Update Category Inline
  const handleUpdateCategory = async (txId: string, category: string) => {
    try {
      const res = await fetch('/api/finance/categorize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txId, sourceOrCategory: category }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Category updated successfully');
        fetchFinanceData();
      } else {
        toast.error(json.error || 'Failed to update category');
      }
    } catch (err) {
      toast.error('Error updating category');
    }
  };

  // Update Payment Method Inline
  const handleUpdatePaymentMethod = async (txId: string, paymentMethod: string) => {
    try {
      const res = await fetch('/api/finance/categorize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txId, paymentMethod }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Payment method updated');
        fetchFinanceData();
      } else {
        toast.error(json.error || 'Failed to update payment method');
      }
    } catch (err) {
      toast.error('Error updating payment method');
    }
  };

  // Delete Transaction
  const handleConfirmDeleteTx = async () => {
    if (!selectedTx) return;
    setDeletingTx(true);
    try {
      const res = await fetch(`/api/finance?id=${selectedTx.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('Transaction record deleted and archived to purge log');
        setIsDeleteConfirmOpen(false);
        setIsDetailOpen(false);
        setSelectedTx(null);
        fetchFinanceData();
      } else {
        toast.error(json.error || 'Failed to delete transaction');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting transaction');
    } finally {
      setDeletingTx(false);
    }
  };

  const transactions: any[] = data?.transactions || [];
  const summary = data?.summary || {};
  const { totalIncome = 0, totalExpense = 0, netProfit = 0, incomeBySource = {}, expenseByCategory = {}, quarterlyTrends = [] } = summary;

  // Filtered Transactions List
  const filteredTx = transactions.filter((t) => {
    if (selectedQuarter !== 'all' && t.quarter !== selectedQuarter) return false;
    if (filterType === 'income' && t.type !== 'income') return false;
    if (filterType === 'expense' && t.type !== 'expense') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCat = (t.sourceOrCategory || '').toLowerCase().includes(q);
      const matchNotes = (t.notes || '').toLowerCase().includes(q);
      const matchAmount = (t.amount || '').toString().includes(q);
      const matchPlatform = (t.platform || '').toLowerCase().includes(q);
      if (!matchCat && !matchNotes && !matchAmount && !matchPlatform) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTx.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTx = filteredTx.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Calculate timelines for Line Chart with Granularity Toggle & Timeline Date Range Filters
  const timelineData = useMemo(() => {
    const timelineMap: Record<string, { date: string; income: number; expense: number; timestamp: number }> = {};

    // Filter transactions exclusively for timeline chart date range
    const filteredForTimeline = transactions.filter((t) => {
      const tDate = new Date(t.date);
      if (timelineStartDate) {
        const start = new Date(timelineStartDate);
        start.setHours(0, 0, 0, 0);
        if (tDate < start) return false;
      }
      if (timelineEndDate) {
        const end = new Date(timelineEndDate);
        end.setHours(23, 59, 59, 999);
        if (tDate > end) return false;
      }
      return true;
    });

    filteredForTimeline.slice().reverse().forEach((t) => {
      const dateObj = new Date(t.date);
      let key = '';
      let sortTimestamp = dateObj.getTime();

      if (timelineGranularity === 'hourly') {
        const dayStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const hourStr = `${dateObj.getHours().toString().padStart(2, '0')}:00`;
        key = `${dayStr} ${hourStr}`;
        const rounded = new Date(dateObj);
        rounded.setMinutes(0, 0, 0);
        sortTimestamp = rounded.getTime();
      } else if (timelineGranularity === 'weekly') {
        const startOfWeek = new Date(dateObj);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        key = `Wk of ${startOfWeek.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
        sortTimestamp = startOfWeek.getTime();
      } else {
        // 'day' default
        key = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const rounded = new Date(dateObj);
        rounded.setHours(0, 0, 0, 0);
        sortTimestamp = rounded.getTime();
      }

      if (!timelineMap[key]) {
        timelineMap[key] = { date: key, income: 0, expense: 0, timestamp: sortTimestamp };
      }
      if (t.type === 'income') timelineMap[key].income += t.amount;
      else timelineMap[key].expense += t.amount;
    });

    const sorted = Object.values(timelineMap).sort((a, b) => a.timestamp - b.timestamp);
    const limit = (timelineStartDate || timelineEndDate) ? 100 : timelineGranularity === 'hourly' ? 30 : timelineGranularity === 'weekly' ? 12 : 25;
    return sorted.slice(-limit);
  }, [transactions, timelineGranularity, timelineStartDate, timelineEndDate]);

  // Pie chart datasets
  const expensePieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value: value as number }));
  const incomePieData = Object.entries(incomeBySource).map(([name, value]) => ({ name, value: value as number }));

  const handleExportCSV = () => {
    const rows = filteredTx.map((t: any) => ({
      Date: new Date(t.date).toLocaleDateString(),
      Type: t.type,
      Category: t.sourceOrCategory,
      Platform: t.platform || '',
      Amount: t.amount,
      PaymentMethod: t.paymentMethod,
      Notes: t.notes || '',
      Quarter: t.quarter,
      Origin: t.origin,
    }));
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(',');
    const csv = [headers, ...rows.map((r: any) => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gapanchor_expanded_finance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#070c18] text-white p-2.5 sm:p-6 md:p-8 space-y-3.5 sm:space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 glass-card !p-3 sm:!p-6 rounded-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="/"
            className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-surface-2 border border-border hover:bg-surface-3 transition-colors text-slate-300 hover:text-white"
            title="Return to Main Dashboard"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
          </a>

          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
            <DollarSign size={20} className="sm:w-6 sm:h-6" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-2xl font-black tracking-tight text-white truncate">
                <span className="sm:hidden">Finance Intel</span>
                <span className="hidden sm:inline">Finance & Revenue Intelligence</span>
              </h1>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                Full Statement
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium hidden sm:block truncate">
              Bank Statement Sync (`Account_Statement.xlsx`) • Dual Credit/Debit Classification • Categorization Engine
            </p>
          </div>
        </div>

        {/* Sync & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary !py-1.5 sm:!py-2.5 !px-3 sm:!px-4 !text-[11px] sm:!text-xs cursor-pointer flex items-center gap-1.5"
          >
            <Upload size={13} className="sm:w-3.5 sm:h-3.5" />
            <span>{uploading ? 'Uploading...' : 'Upload Excel'}</span>
          </button>

          <button
            onClick={handleQuickSyncStatement}
            disabled={syncing}
            className="px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:opacity-95 text-white font-extrabold text-[11px] sm:text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
            title="Auto-sync Account_Statement.xlsx"
          >
            <FileSpreadsheet size={14} className="sm:w-[15px] sm:h-[15px]" />
            <span>{syncing ? 'Syncing...' : 'Sync Statement'}</span>
          </button>

          <button onClick={handleExportCSV} className="btn-secondary !py-1.5 sm:!py-2.5 !px-2.5 sm:!px-3.5 !text-[11px] sm:!text-xs">
            <Download size={13} className="sm:w-3.5 sm:h-3.5" />
            <span>CSV</span>
          </button>

          <button onClick={fetchFinanceData} disabled={loading} className="btn-secondary !p-1.5 sm:!p-2.5 !rounded-xl">
            <RefreshCw size={14} className={`sm:w-[15px] sm:h-[15px] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Sync & Loading Banner */}
      {loading && (
        <div className="glass-card p-3 sm:p-4 rounded-2xl flex items-center justify-between border-emerald-500/30 bg-emerald-950/30 text-emerald-300 font-bold text-xs sm:text-sm animate-pulse">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Loader2 size={18} className="animate-spin text-emerald-400" />
            <span className="text-xs sm:text-sm">Synchronizing Financial Analytics & Statement Records...</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-mono hidden sm:inline">Refreshing Data</span>
        </div>
      )}

      {/* KPI Summary Scorecards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="glass-card !p-3 sm:!p-5 rounded-2xl sm:rounded-3xl space-y-1 sm:space-y-2 border-emerald-500/20 bg-emerald-950/20">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Total Income</span>
            <TrendingUp size={16} className="sm:w-[18px] sm:h-[18px] shrink-0" />
          </div>
          <p className="text-base sm:text-3xl font-black font-mono text-emerald-300 truncate">
            {formatCurrency(totalIncome)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
            {transactions.filter(t => t.type === 'income').length} credit entries
          </p>
        </div>

        <div className="glass-card !p-3 sm:!p-5 rounded-2xl sm:rounded-3xl space-y-1 sm:space-y-2 border-rose-500/20 bg-rose-950/20">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Total Expense</span>
            <TrendingDown size={16} className="sm:w-[18px] sm:h-[18px] shrink-0" />
          </div>
          <p className="text-base sm:text-3xl font-black font-mono text-rose-300 truncate">
            {formatCurrency(totalExpense)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
            {transactions.filter(t => t.type === 'expense').length} debit entries
          </p>
        </div>

        <div className="glass-card !p-3 sm:!p-5 rounded-2xl sm:rounded-3xl space-y-1 sm:space-y-2 border-indigo-500/20 bg-indigo-950/20">
          <div className="flex items-center justify-between text-indigo-400">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Net Profit</span>
            <DollarSign size={16} className="sm:w-[18px] sm:h-[18px] shrink-0" />
          </div>
          <p className={`text-base sm:text-3xl font-black font-mono truncate ${netProfit >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
            Margin: {totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0}%
          </p>
        </div>

        <div className="glass-card !p-3 sm:!p-5 rounded-2xl sm:rounded-3xl space-y-1 sm:space-y-2 border-cyan-500/20 bg-cyan-950/20">
          <div className="flex items-center justify-between text-cyan-400">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">Transactions</span>
            <Layers size={16} className="sm:w-[18px] sm:h-[18px] shrink-0" />
          </div>
          <p className="text-base sm:text-3xl font-black font-mono text-cyan-300 truncate">
            {transactions.length} Records
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
            Filtered: {filteredTx.length} active
          </p>
        </div>
      </div>

      {/* Flagship Expense Analytics & Breakdown Dashboard Component */}
      <ExpenseBreakdownDashboard />

      {/* Flagship Income Analytics & Money Flow Dashboard Component */}
      <IncomeBreakdownDashboard />

      {/* Multi-Chart Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue & Expense Timeline Flow */}
        <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white">
              <LineChartIcon size={18} className="text-emerald-400" />
              <div>
                <h3 className="text-base font-extrabold">Credit & Debit Timeline Flow</h3>
                <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                  {timelineGranularity === 'hourly' ? 'Hourly Sequence' : timelineGranularity === 'weekly' ? 'Weekly Aggregation' : 'Daily Sequence'}
                </p>
              </div>
            </div>

            {/* Timeframe Granularity Toggle & Calendar Popover Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center p-1 bg-surface-2 border border-border/80 rounded-xl gap-1 shrink-0">
                {[
                  { id: 'hourly', label: 'Hourly' },
                  { id: 'day', label: 'Day' },
                  { id: 'weekly', label: 'Weekly' },
                ].map((gran) => (
                  <button
                    key={gran.id}
                    onClick={() => setTimelineGranularity(gran.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timelineGranularity === gran.id
                        ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-surface-3'
                    }`}
                  >
                    {gran.label}
                  </button>
                ))}
              </div>

              {/* Compact Calendar Button & Floating Popover */}
              <div className="relative">
                <button
                  onClick={() => setIsDatePopoverOpen(!isDatePopoverOpen)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    timelinePreset !== 'all' || timelineStartDate || timelineEndDate
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10'
                      : 'bg-surface-2 border-border/80 text-slate-300 hover:text-white hover:bg-surface-3'
                  }`}
                  title="Filter Chart Date Range"
                >
                  <Calendar size={14} className={timelinePreset !== 'all' || timelineStartDate || timelineEndDate ? 'text-emerald-400' : 'text-slate-400'} />
                  <span>
                    {timelinePreset === 'all'
                      ? 'All Time'
                      : timelinePreset === 'jun'
                      ? 'Jun 2026'
                      : timelinePreset === 'jul'
                      ? 'Jul 2026'
                      : timelinePreset === 'aug'
                      ? 'Aug 2026'
                      : timelinePreset === 'sep'
                      ? 'Sep 2026'
                      : timelineStartDate || timelineEndDate
                      ? `${timelineStartDate || 'Start'} → ${timelineEndDate || 'End'}`
                      : 'Calendar Filter'}
                  </span>
                  <ChevronDown size={13} className={`transition-transform duration-200 ${isDatePopoverOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Floating Calendar Dropdown Popover */}
                {isDatePopoverOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDatePopoverOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-72 p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl backdrop-blur-xl animate-fade-in space-y-3.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <Calendar size={14} className="text-emerald-400" /> Filter Date Range
                        </span>
                        <button
                          onClick={() => setIsDatePopoverOpen(false)}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Presets Grid */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Quick Presets</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'all', label: 'All Time' },
                            { id: 'jun', label: 'Jun 2026' },
                            { id: 'jul', label: 'Jul 2026' },
                            { id: 'aug', label: 'Aug 2026' },
                            { id: 'sep', label: 'Sep 2026' },
                          ].map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                handleTimelinePresetChange(preset.id);
                                setIsDatePopoverOpen(false);
                              }}
                              className={`px-2.5 py-1.5 rounded-lg font-medium text-xs text-left transition-all cursor-pointer ${
                                timelinePreset === preset.id
                                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold'
                                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-transparent'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Range Inputs */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Custom Date Range</span>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400 shrink-0">From:</span>
                            <input
                              type="date"
                              value={timelineStartDate}
                              onChange={(e) => {
                                setTimelineStartDate(e.target.value);
                                setTimelinePreset('custom');
                              }}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 w-full"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400 shrink-0">To:</span>
                            <input
                              type="date"
                              value={timelineEndDate}
                              onChange={(e) => {
                                setTimelineEndDate(e.target.value);
                                setTimelinePreset('custom');
                              }}
                              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60 w-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                        <button
                          onClick={() => {
                            handleTimelinePresetChange('all');
                            setIsDatePopoverOpen(false);
                          }}
                          className="text-slate-400 hover:text-rose-400 font-semibold transition-colors cursor-pointer"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => setIsDatePopoverOpen(false)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer"
                        >
                          Apply Filter
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), '']}
                  contentStyle={{ background: '#0b1329', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="income" name="Income (Credit)" stroke="#10b981" strokeWidth={3} fill="url(#incGrad)" />
                <Area type="monotone" dataKey="expense" name="Expense (Debit)" stroke="#f43f5e" strokeWidth={3} fill="url(#expGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Unified Income & Expense Category Breakdown (Single Pie) */}
        <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white">
              <PieChartIcon size={18} className="text-emerald-400" />
              <div>
                <h3 className="text-base font-extrabold">Income & Expense Breakdown</h3>
                <p className="text-[10px] text-slate-400 font-medium">Single Pie Chart Distribution</p>
              </div>
            </div>

            {/* View Selector Pills */}
            <div className="flex rounded-xl p-1 border border-border/80 bg-surface-2 text-xs font-bold shrink-0">
              {[
                { id: 'combined', label: 'Single Pie' },
                { id: 'income', label: 'Income' },
                { id: 'expense', label: 'Expense' },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setBreakdownView(v.id as any)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    breakdownView === v.id
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-60 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="pageIncPieGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f8fafc" />
                      <stop offset="50%" stopColor="#cbd5e1" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                    <linearGradient id="pageExpPieGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#475569" />
                      <stop offset="50%" stopColor="#334155" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={
                      breakdownView === 'combined'
                        ? [
                            ...incomePieData.map((item, i) => ({
                              ...item,
                              name: `${item.name} (Income)`,
                              fill: 'url(#pageIncPieGrad)',
                            })),
                            ...expensePieData.map((item, i) => ({
                              ...item,
                              name: `${item.name} (Expense)`,
                              fill: 'url(#pageExpPieGrad)',
                            })),
                          ]
                        : breakdownView === 'income'
                        ? incomePieData.map((item, i) => ({ ...item, fill: ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'][i % 5] }))
                        : expensePieData.map((item, i) => ({ ...item, fill: ['#64748b', '#475569', '#334155', '#1e293b', '#0f172a'][i % 5] }))
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    stroke="rgba(15, 23, 42, 0.9)"
                    strokeWidth={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {(breakdownView === 'combined'
                      ? [
                          ...incomePieData.map((item, i) => ({ ...item, fill: 'url(#pageIncPieGrad)' })),
                          ...expensePieData.map((item, i) => ({ ...item, fill: 'url(#pageExpPieGrad)' })),
                        ]
                      : breakdownView === 'income'
                      ? incomePieData.map((item, i) => ({ ...item, fill: ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'][i % 5] }))
                      : expensePieData.map((item, i) => ({ ...item, fill: ['#64748b', '#475569', '#334155', '#1e293b', '#0f172a'][i % 5] }))
                    ).map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), '']}
                    contentStyle={{
                      background: '#0b1329',
                      borderColor: '#475569',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Net Profit</span>
                <span className={`text-sm font-black font-mono mt-0.5 ${netProfit >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>


            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {(breakdownView === 'combined' || breakdownView === 'income') && (
                <div>
                  <span className="text-[11px] font-extrabold uppercase text-emerald-400 block mb-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Income ({formatCurrency(totalIncome)})
                  </span>
                  <div className="space-y-1.5">
                    {incomePieData.map((item) => {
                      const totalVol = totalIncome + totalExpense;
                      const pct = totalVol > 0 ? ((item.value / totalVol) * 100).toFixed(0) : 0;
                      return (
                        <div key={item.name} className="p-2 rounded-xl bg-surface-2 border border-border/60 text-xs">
                          <div className="flex justify-between font-bold">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
                              <span className="truncate">{item.name}</span>
                            </span>
                            <span className="text-emerald-300 font-mono shrink-0">{formatCurrency(item.value)} ({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(breakdownView === 'combined' || breakdownView === 'expense') && (
                <div>
                  <span className="text-[11px] font-extrabold uppercase text-rose-400 block mb-1.5">
                    Expense Categories (Debit)
                  </span>
                  <div className="space-y-1.5">
                    {expensePieData.map((item, i) => {
                      const pct = totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(0) : 0;
                      return (
                        <div key={item.name} className="p-2 rounded-xl bg-surface-2 border border-border/60 text-xs">
                          <div className="flex justify-between font-bold">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[(i + 2) % CHART_COLORS.length] }} />
                              <span className="truncate">{item.name}</span>
                            </span>
                            <span className="text-rose-300 font-mono shrink-0">{formatCurrency(item.value)} ({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart 3: Quarterly Revenue & Net Profit Bar Graph */}
        <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <BarChart3 size={18} className="text-indigo-400" />
              <h3 className="text-base font-extrabold">Quarterly Comparison (Q1 - Q4)</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">Running Quarterly Trends</span>
          </div>

          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarterlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="quarter" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), '']}
                  contentStyle={{ background: '#0b1329', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="net" name="Net Margin" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Interactive Statement Categorization & Transaction Table */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
        {/* Table Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-full border border-border p-1 bg-surface-2">
              {(['all', 'income', 'expense'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold rounded-full transition-all cursor-pointer ${
                    filterType === type ? 'bg-brand-500 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">{type === 'all' ? 'All' : type === 'income' ? '↑ Credit' : '↓ Debit'}</span>
                  <span className="hidden sm:inline">{type === 'all' ? 'All Transactions' : type === 'income' ? '↑ Credit (Income)' : '↓ Debit (Expense)'}</span>
                </button>
              ))}
            </div>

            {/* Quarter Filter */}
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold bg-surface-2 text-white outline-none cursor-pointer"
            >
              <option value="all">All Quarters</option>
              <option value="Q1">Q1 (Jan - Mar)</option>
              <option value="Q2">Q2 (Apr - Jun)</option>
              <option value="Q3">Q3 (Jul - Sep)</option>
              <option value="Q4">Q4 (Oct - Dec)</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[240px] flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search particulars, ref no, amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border pl-9 pr-3 py-1.5 text-xs bg-surface-2 text-white outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* ── Desktop Transactions Table (>= md) ── */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3">Date</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-4 py-3">Category (Inline Select)</th>
                <th className="px-4 py-3">Particulars & Reference</th>
                <th className="px-3 py-3">Payment Method</th>
                <th className="px-3 py-3">Platform</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs font-medium">
                    No transactions match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>

                    <td className="px-3 py-3">
                      <span className={tx.type === 'income' ? 'badge-income badge' : 'badge-expense badge'}>
                        {tx.type.toUpperCase()}
                      </span>
                    </td>

                    {/* Inline Category Select - Fixed Width & Aligned */}
                    <td className="px-4 py-3 shrink-0">
                      <select
                        value={tx.sourceOrCategory}
                        onChange={(e) => handleUpdateCategory(tx.id, e.target.value)}
                        className="w-48 h-8.5 rounded-lg border border-border/80 px-2.5 py-1 text-[11px] font-bold bg-slate-900 text-cyan-300 outline-none cursor-pointer hover:border-cyan-500 truncate"
                      >
                        {(tx.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Human Readable Particulars & Reference */}
                    <td className="px-4 py-3 max-w-sm">
                      {(() => {
                        const formatted = formatParticularsAndRef(tx.notes);
                        return (
                          <div className="flex flex-col gap-0.5" title={formatted.raw || '—'}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-100 text-[11px] tracking-tight">
                                {formatted.primary}
                              </span>
                              {formatted.refNo && (
                                <span className="px-1.5 py-0.2 text-[9px] font-mono font-semibold rounded bg-slate-800/90 text-cyan-300 border border-slate-700/80">
                                  {formatted.refNo}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                              <span>{formatted.secondary}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Inline Payment Method Select - Fixed Width & Aligned */}
                    <td className="px-3 py-3 shrink-0">
                      <select
                        value={tx.paymentMethod || 'Bank Transfer'}
                        onChange={(e) => handleUpdatePaymentMethod(tx.id, e.target.value)}
                        className="w-32 h-8.5 rounded-lg border border-border/80 px-2.5 py-1 text-[11px] font-bold bg-slate-900 text-indigo-300 outline-none cursor-pointer hover:border-indigo-500 truncate"
                      >
                        {PAYMENT_METHODS.map((pm) => (
                          <option key={pm} value={pm}>
                            {pm}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-3 text-cyan-400 font-medium">
                      {tx.platform || 'General'}
                    </td>

                    <td className={`px-4 py-3 text-right font-black font-mono ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => { setSelectedTx(tx); setIsDetailOpen(true); }}
                          className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>

                        <button
                          onClick={() => { setSelectedTx(tx); setIsDeleteConfirmOpen(true); }}
                          className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer"
                          title="Delete & Archive"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile Transactions Cards (< md) ── */}
        <div className="md:hidden space-y-2">
          {filteredTx.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium border border-dashed border-border rounded-xl">
              No transactions match your search or filter criteria.
            </div>
          ) : (
            paginatedTx.map((tx) => {
              const isExpanded = expandedTxId === tx.id;
              const isIncome = tx.type === 'income';
              const formatted = formatParticularsAndRef(tx.notes);
              const formattedDate = new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

              return (
                <div
                  key={`mobile-tx-${tx.id}`}
                  className={`rounded-2xl border transition-all duration-200 ${
                    isExpanded
                      ? 'bg-slate-900/95 border-slate-700/90 shadow-lg'
                      : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800/80'
                  }`}
                >
                  {/* Card Header (Always Visible, Compact, Even & Clean) */}
                  <div
                    onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                    role="button"
                    tabIndex={0}
                    className="p-3 cursor-pointer select-none space-y-1.5"
                  >
                    {/* Top Row: Date & Type Badge on Left, Amount & Dropdown Chevron on Right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono font-medium text-slate-400 shrink-0">
                          {formattedDate}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${
                            isIncome
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {tx.type.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs sm:text-sm font-black font-mono ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <div className="w-5 h-5 rounded-lg text-slate-400 flex items-center justify-center transition-transform duration-200">
                          {isExpanded ? <ChevronUp size={14} className="text-cyan-400" /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row of Header: Category Badge & Particulars Summary */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 truncate max-w-[150px] shrink-0">
                          {tx.sourceOrCategory}
                        </span>
                        <span className="text-[11px] text-slate-300 font-medium truncate flex-1">
                          {formatted.primary}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Dropdown Content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 space-y-2.5 animate-fade-in text-xs">
                      {/* Particulars & Reference Full Detail */}
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/70 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Particulars & Notes
                          </span>
                          {formatted.refNo && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              Ref: {formatted.refNo}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-200 font-semibold text-xs leading-relaxed break-words">
                          {formatted.raw || formatted.primary}
                        </p>
                        {formatted.secondary && (
                          <p className="text-[10px] text-slate-400">
                            {formatted.secondary}
                          </p>
                        )}
                      </div>

                      {/* Inline Selects Grid: Category & Payment Method */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/60">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Category
                          </label>
                          <select
                            value={tx.sourceOrCategory}
                            onChange={(e) => handleUpdateCategory(tx.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs font-semibold py-1 px-2 rounded-lg bg-slate-800/90 text-cyan-300 border border-slate-700/80 focus:border-cyan-400 focus:outline-none cursor-pointer truncate"
                          >
                            {(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/60">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Payment Method
                          </label>
                          <select
                            value={tx.paymentMethod || 'Bank Transfer'}
                            onChange={(e) => handleUpdatePaymentMethod(tx.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs font-semibold py-1 px-2 rounded-lg bg-slate-800/90 text-indigo-300 border border-slate-700/80 focus:border-indigo-400 focus:outline-none cursor-pointer truncate"
                          >
                            {PAYMENT_METHODS.map((pm) => (
                              <option key={pm} value={pm}>
                                {pm}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Platform & Quick Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] text-slate-400">
                          Platform: <span className="font-semibold text-cyan-400">{tx.platform || 'General'}</span>
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTx(tx);
                              setIsDetailOpen(true);
                            }}
                            className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTx(tx);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="py-1.5 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Analytics Table Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs font-medium text-slate-400">
          <span>
            Showing {filteredTx.length > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredTx.length)} of {filteredTx.length} records
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold cursor-pointer text-slate-300 flex items-center gap-1"
            >
              <ChevronLeft size={13} />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-300 font-extrabold">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3.5 py-1.5 rounded-xl border border-brand-500/40 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-extrabold cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <span>Next Page</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Detail View Modal */}
      {isDetailOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsDetailOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl border border-border bg-[#0b1329] p-6 shadow-2xl animate-slide-up text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold">Transaction Info Details</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedTx.id}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-5 text-xs">
              <div className="p-3.5 rounded-2xl bg-surface-2 border border-border/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Type & Amount:</span>
                  <span className={`font-mono font-bold ${selectedTx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedTx.type.toUpperCase()} ({formatCurrency(selectedTx.amount)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Category:</span>
                  <span className="font-bold text-white">{selectedTx.sourceOrCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Method:</span>
                  <span className="font-bold text-indigo-300">{selectedTx.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date & Quarter:</span>
                  <span className="font-mono text-slate-200">{formatDate(selectedTx.date)} ({selectedTx.quarter} {selectedTx.year})</span>
                </div>
                <div className="pt-2 border-t border-border/40">
                  <span className="text-slate-400 block mb-1">Particulars / Notes:</span>
                  <p className="p-2 rounded-xl bg-slate-900 font-mono text-slate-300">{selectedTx.notes || '—'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} /> Delete Record
              </button>

              <button onClick={() => setIsDetailOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {isDeleteConfirmOpen && selectedTx && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-fade-in" onClick={() => !deletingTx && setIsDeleteConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#0c1222] p-6 shadow-2xl text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Confirm Record Deletion</h3>
                <p className="text-xs text-slate-400">Archival purge enabled</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Are you sure you want to delete <strong className="text-white bg-slate-800 px-2 py-0.5 rounded">{selectedTx.sourceOrCategory} ({formatCurrency(selectedTx.amount)})</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button onClick={() => setIsDeleteConfirmOpen(false)} disabled={deletingTx} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-300">
                Cancel
              </button>
              <button onClick={handleConfirmDeleteTx} disabled={deletingTx} className="flex items-center gap-2 px-5 py-2 text-xs font-extrabold rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white">
                {deletingTx ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-Session Training Finance Comparison Bar Graph (At Bottom as Requested) */}
      <SessionFinanceBarChart />

      {/* Add Client Collection Entry Modal */}

      <AddCollectionModal
        isOpen={isAddCollectionModalOpen}
        onClose={() => setIsAddCollectionModalOpen(false)}
        onSuccess={fetchFinanceData}
      />
    </div>
  );
}
