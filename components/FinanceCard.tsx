'use client';

import React, { useState } from 'react';
import { DollarSign, PlusCircle, Filter, Download, TrendingUp, Eye, Trash2, X, AlertTriangle, Loader2, Info, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { toast } from 'sonner';

interface Props {
  financeData: any;
  onOpenModal: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'];

export default function FinanceCard({ financeData, onOpenModal, onRefresh, loading }: Props) {
  const [activeTab, setActiveTab] = useState<'charts' | 'transactions'>('charts');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [breakdownView, setBreakdownView] = useState<'combined' | 'income' | 'expense'>('combined');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Transaction Detail & Delete Modal State
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <SkeletonCard />;

  const { summary, transactions = [] } = financeData || {};
  const { totalIncome = 0, totalExpense = 0, netProfit = 0, quarterlyTrends = [], incomeBySource = {}, expenseByCategory = {} } = summary || {};

  const expensePieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value: value as number }));
  const incomePieData = Object.entries(incomeBySource).map(([name, value]) => ({ name, value: value as number }));

  const handleFilterChange = (f: 'all' | 'income' | 'expense') => {
    setFilterType(f);
    setCurrentPage(1);
  };

  const filteredTx = transactions.filter((t: any) => {
    if (filterType === 'income') return t.type === 'income';
    if (filterType === 'expense') return t.type === 'expense';
    return true;
  });

  const totalPages = Math.ceil(filteredTx.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTx = filteredTx.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleExportCSV = async () => {
    const rows = transactions.map((t: any) => ({
      Date: new Date(t.date).toLocaleDateString(),
      Type: t.type,
      Category: t.sourceOrCategory,
      Platform: t.platform || '',
      Amount: t.amount,
      PaymentMethod: t.paymentMethod,
      Notes: t.notes || '',
      Origin: t.origin,
    }));
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(',');
    const csv = [headers, ...rows.map((r: any) => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gapanchor_finance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleOpenDetail = (tx: any) => {
    setSelectedTx(tx);
    setIsDetailOpen(true);
  };

  const handleConfirmDeleteTx = async () => {
    if (!selectedTx) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/finance?id=${selectedTx.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Transaction record deleted & archived to purge log`);
        setIsDeleteConfirmOpen(false);
        setIsDetailOpen(false);
        setSelectedTx(null);
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.error || 'Failed to delete transaction record');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting transaction record');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="glass-card xl:col-span-2 animate-slide-up !p-3 sm:!p-6 rounded-2xl sm:rounded-3xl w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-3 sm:mb-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <DollarSign size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-extrabold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>Finance & Revenue Intelligence</h2>
            <p className="text-[10px] sm:text-xs font-medium truncate" style={{ color: 'var(--text-tertiary)' }}>Quarterly Running Totals • Category Breakdown • Outlook Email Auto-Sync Ready</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
          {/* Tab toggle */}
          <div className="flex rounded-full border border-border p-0.5 sm:p-1" style={{ background: 'var(--surface-2)' }}>
            <button onClick={() => setActiveTab('charts')} className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold rounded-full transition-all ${activeTab === 'charts' ? 'bg-brand-500 text-white shadow-md' : 'hover:bg-surface-3'}`} style={activeTab !== 'charts' ? { color: 'var(--text-secondary)' } : {}}>
              Analytics
            </button>
            <button onClick={() => setActiveTab('transactions')} className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold rounded-full transition-all ${activeTab === 'transactions' ? 'bg-brand-500 text-white shadow-md' : 'hover:bg-surface-3'}`} style={activeTab !== 'transactions' ? { color: 'var(--text-secondary)' } : {}}>
              Transactions ({transactions.length})
            </button>
          </div>

          <button onClick={handleExportCSV} className="btn-secondary !py-1 sm:!py-1.5 !px-2.5 sm:!px-3 !text-[11px] sm:!text-xs">
            <Download size={12} className="sm:w-[13px] sm:h-[13px]" />
            <span>CSV</span>
          </button>

          <button onClick={onOpenModal} className="btn-primary !py-1 sm:!py-1.5 !px-2.5 sm:!px-3 !text-[11px] sm:!text-xs">
            <PlusCircle size={12} className="sm:w-[13px] sm:h-[13px]" />
            <span>Add Entry</span>
          </button>

          <a
            href="/finance/analytics"
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-brand-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all shadow-md shadow-brand-500/20 cursor-pointer"
            title="Open Expanded Finance Intelligence & Excel Import View"
          >
            <Maximize2 size={12} className="sm:w-[13px] sm:h-[13px]" />
            <span>Expanded View</span>
          </a>
        </div>
      </div>

      {activeTab === 'charts' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 sm:gap-3 lg:gap-5">
          {/* Liquid Gradient Area chart */}
          <div className="lg:col-span-2 rounded-xl sm:rounded-2xl p-2.5 sm:p-5 border border-border/80" style={{ background: 'var(--surface-2)' }}>
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-emerald-400 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>Quarterly Revenue & Expense Flow</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold">
                Net Profit: {formatCurrency(netProfit)}
              </div>
            </div>

            <div className="h-40 sm:h-64 mt-2 sm:mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={quarterlyTrends}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="quarter" stroke="var(--text-tertiary)" fontSize={11} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={10} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), '']}
                    contentStyle={{ background: 'var(--surface-1)', backdropFilter: 'blur(16px)', borderColor: 'var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: '600' }} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#incomeGrad)" />
                  <Area type="monotone" dataKey="expense" name="Expense" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#expenseGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Single Unified Income & Expense Breakdown Card */}
          <div className="rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-border/80 space-y-2.5 sm:space-y-3" style={{ background: 'var(--surface-2)' }}>
            {/* Header with Title & View Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider block" style={{ color: 'var(--text-primary)' }}>
                  Income & Expense Breakdown
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Single Pie Distribution • Income vs. Expense
                </span>
              </div>

              {/* View Selector Pills */}
              <div className="flex rounded-lg p-0.5 border border-border bg-surface-1 text-[11px] font-bold">
                {[
                  { id: 'combined', label: 'Single Pie' },
                  { id: 'income', label: 'Income' },
                  { id: 'expense', label: 'Expense' },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setBreakdownView(v.id as any)}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      breakdownView === v.id
                        ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Single Pie/Doughnut Chart Container */}
            <div className="h-44 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="incPieGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f8fafc" />
                      <stop offset="50%" stopColor="#cbd5e1" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                    <linearGradient id="expPieGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#475569" />
                      <stop offset="50%" stopColor="#334155" />
                      <stop offset="100%" stopColor="#1e293b" />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={
                      breakdownView === 'combined'
                        ? [
                            ...incomePieData.map((item) => ({
                              ...item,
                              name: `${item.name} (Income)`,
                              fill: 'url(#incPieGrad)',
                            })),
                            ...expensePieData.map((item) => ({
                              ...item,
                              name: `${item.name} (Expense)`,
                              fill: 'url(#expPieGrad)',
                            })),
                          ]
                        : breakdownView === 'income'
                        ? incomePieData.map((item, i) => ({ ...item, fill: ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'][i % 5] }))
                        : expensePieData.map((item, i) => ({ ...item, fill: ['#64748b', '#475569', '#334155', '#1e293b', '#0f172a'][i % 5] }))
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={4}
                    stroke="rgba(15, 23, 42, 0.9)"
                    strokeWidth={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {(breakdownView === 'combined'
                      ? [
                          ...incomePieData.map((item) => ({ ...item, fill: 'url(#incPieGrad)' })),
                          ...expensePieData.map((item) => ({ ...item, fill: 'url(#expPieGrad)' })),
                        ]
                      : breakdownView === 'income'
                      ? incomePieData.map((item, i) => ({ ...item, fill: ['#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b'][i % 5] }))
                      : expensePieData.map((item, i) => ({ ...item, fill: ['#64748b', '#475569', '#334155', '#1e293b', '#0f172a'][i % 5] }))
                    ).map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={entry.fill}
                        className="transition-all duration-300 hover:opacity-90 hover:scale-105 cursor-pointer outline-none"
                      />
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

              {/* Center Net Margin Badge */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Net Profit</span>
                <span className={`text-xs sm:text-sm font-black font-mono mt-0.5 ${netProfit >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
            </div>

            {/* Interactive Legend List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40">
              {(breakdownView === 'combined' || breakdownView === 'income') && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                    Income ({formatCurrency(totalIncome)})
                  </span>
                  {incomePieData.map((item) => {
                    const totalVol = totalIncome + totalExpense;
                    const pct = totalVol > 0 ? ((item.value / totalVol) * 100).toFixed(0) : 0;
                    return (
                      <div key={item.name} className="flex justify-between items-center text-[11px] p-1.5 rounded-lg bg-surface-1/60 border border-border/40">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-slate-300" />
                          <span className="truncate text-slate-300">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-200 shrink-0 font-mono">{formatCurrency(item.value)} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {(breakdownView === 'combined' || breakdownView === 'expense') && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Expense ({formatCurrency(totalExpense)})
                  </span>
                  {expensePieData.map((item) => {
                    const totalVol = totalIncome + totalExpense;
                    const pct = totalVol > 0 ? ((item.value / totalVol) * 100).toFixed(0) : 0;
                    return (
                      <div key={item.name} className="flex justify-between items-center text-[11px] p-1.5 rounded-lg bg-surface-1/60 border border-border/40">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0 bg-slate-500" />
                          <span className="truncate text-slate-300">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-400 shrink-0 font-mono">{formatCurrency(item.value)} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        <div>
          {/* Filter row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter size={13} style={{ color: 'var(--text-tertiary)' }} />
              {(['all', 'income', 'expense'] as const).map(f => (
                <button key={f} onClick={() => handleFilterChange(f)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${filterType === f ? 'border-brand-500/40 bg-brand-500/20 text-brand-300' : 'border-transparent hover:bg-surface-2'}`} style={filterType !== f ? { color: 'var(--text-secondary)' } : {}}>
                  {f === 'all' ? 'All' : f === 'income' ? '↑ Income' : '↓ Expense'}
                </button>
              ))}
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{filteredTx.length} records</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Date', 'Type', 'Category', 'Notes', 'Payment', 'Origin', 'Amount', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b border-border" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedTx.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-4 py-3.5"><span className={tx.type === 'income' ? 'badge-income badge' : 'badge-expense badge'}>{tx.type.toUpperCase()}</span></td>
                    <td className="px-4 py-3.5 font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{tx.sourceOrCategory}</td>
                    <td className="px-4 py-3.5 text-xs max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>{tx.notes || '—'}</td>
                    <td className="px-4 py-3.5"><span className={`badge ${tx.paymentMethod === 'UPI' ? 'badge-upi' : tx.paymentMethod === 'Cash' ? 'badge-cash' : tx.paymentMethod === 'Bank Transfer' ? 'badge-bank' : 'badge-card'}`}>{tx.paymentMethod}</span></td>
                    <td className="px-4 py-3.5 text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{tx.origin}</td>
                    <td className={`px-4 py-3.5 text-right font-extrabold font-mono text-sm ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleOpenDetail(tx)}
                        className="px-2.5 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        title="View Detailed Transaction Info"
                      >
                        <Eye size={12} />
                        <span>Detail View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            <span>
              Showing {filteredTx.length > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredTx.length)} of {filteredTx.length} records
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold cursor-pointer flex items-center gap-1"
                style={{ color: 'var(--text-secondary)' }}
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
      )}

      {/* Transaction Detail View Modal */}
      {isDetailOpen && selectedTx && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-border bg-[#0b1329] p-6 shadow-2xl animate-slide-up text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-lg shrink-0">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    Transaction Details
                    <span className={selectedTx.type === 'income' ? 'badge-income badge' : 'badge-expense badge'}>
                      {selectedTx.type.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedTx.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Info Fields */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-2 border border-border/80">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Category / Source</span>
                  <span className="text-sm font-extrabold text-white">{selectedTx.sourceOrCategory}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Amount</span>
                  <span className={`text-base font-extrabold font-mono ${selectedTx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedTx.type === 'income' ? '+' : '-'}{formatCurrency(selectedTx.amount)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Transaction Date</span>
                  <span className="text-xs font-semibold text-slate-200">{formatDate(selectedTx.date)}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Payment Method</span>
                  <span className={`badge ${selectedTx.paymentMethod === 'UPI' ? 'badge-upi' : selectedTx.paymentMethod === 'Cash' ? 'badge-cash' : selectedTx.paymentMethod === 'Bank Transfer' ? 'badge-bank' : 'badge-card'}`}>
                    {selectedTx.paymentMethod}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Platform</span>
                  <span className="text-xs font-semibold text-cyan-300">{selectedTx.platform || 'General Ops'}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Quarter & Year</span>
                  <span className="text-xs font-mono font-bold text-indigo-300">{selectedTx.quarter} {selectedTx.year}</span>
                </div>

                <div className="col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Origin / Source System</span>
                  <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 text-amber-300 inline-block">
                    {selectedTx.origin}
                  </span>
                </div>

                {selectedTx.notes && (
                  <div className="col-span-2 pt-2 border-t border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Notes & Reference</span>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      {selectedTx.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete Record</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup Dialog */}
      {isDeleteConfirmOpen && selectedTx && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => !deleting && setIsDeleteConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#0c1222] p-6 shadow-2xl shadow-rose-950/80 animate-slide-up text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  Confirm Transaction Deletion
                </h3>
                <p className="text-xs text-slate-400">
                  Archival purge enabled • Permanent audit safety
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to delete the transaction record for{' '}
                <strong className="text-white font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {selectedTx.sourceOrCategory} ({formatCurrency(selectedTx.amount)})
                </strong>
                ?
              </p>

              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Deletion Action:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 opacity-90">
                  <li>Removes the transaction from live finance dashboard calculations</li>
                  <li>Archives the full record to the purged log table for audit safety</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={deleting}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteTx}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-95 text-white shadow-lg shadow-rose-600/30 disabled:opacity-50 transition-all cursor-pointer"
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirm Delete Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

