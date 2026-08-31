'use client';

import React, { useState } from 'react';
import { DollarSign, PlusCircle, Filter, Download, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface Props {
  financeData: any;
  onOpenModal: () => void;
  loading?: boolean;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'];

export default function FinanceCard({ financeData, onOpenModal, loading }: Props) {
  const [activeTab, setActiveTab] = useState<'charts' | 'transactions'>('charts');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  if (loading) return <SkeletonCard />;

  const { summary, transactions = [] } = financeData || {};
  const { totalIncome = 0, totalExpense = 0, netProfit = 0, quarterlyTrends = [], incomeBySource = {}, expenseByCategory = {} } = summary || {};

  const expensePieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value: value as number }));
  const incomePieData = Object.entries(incomeBySource).map(([name, value]) => ({ name, value: value as number }));

  const filteredTx = transactions.filter((t: any) => {
    if (filterType === 'income') return t.type === 'income';
    if (filterType === 'expense') return t.type === 'expense';
    return true;
  });

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

  return (
    <div className="glass-card col-span-2 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <DollarSign size={22} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Finance & Revenue Intelligence</h2>
            <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Quarterly Running Totals • Category Breakdown • Outlook Email Auto-Sync Ready</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab toggle */}
          <div className="flex rounded-full border border-border p-1" style={{ background: 'var(--surface-2)' }}>
            <button onClick={() => setActiveTab('charts')} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${activeTab === 'charts' ? 'bg-brand-500 text-white shadow-md' : 'hover:bg-surface-3'}`} style={activeTab !== 'charts' ? { color: 'var(--text-secondary)' } : {}}>
              Analytics
            </button>
            <button onClick={() => setActiveTab('transactions')} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${activeTab === 'transactions' ? 'bg-brand-500 text-white shadow-md' : 'hover:bg-surface-3'}`} style={activeTab !== 'transactions' ? { color: 'var(--text-secondary)' } : {}}>
              Transactions ({transactions.length})
            </button>
          </div>

          <button onClick={handleExportCSV} className="btn-secondary !py-1.5 !px-3 !text-xs">
            <Download size={13} />
            CSV
          </button>

          <button onClick={onOpenModal} className="btn-primary !py-1.5 !px-3 !text-xs">
            <PlusCircle size={13} />
            Add Entry
          </button>
        </div>
      </div>

      {activeTab === 'charts' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Liquid Gradient Area chart */}
          <div className="lg:col-span-2 rounded-2xl p-5 border border-border/80" style={{ background: 'var(--surface-2)' }}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" />
                <span className="text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>Quarterly Revenue & Expense Flow</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">
                Net Profit: {formatCurrency(netProfit)}
              </div>
            </div>

            <div className="h-64">
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
                  <XAxis dataKey="quarter" stroke="var(--text-tertiary)" fontSize={12} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), '']}
                    contentStyle={{ background: 'var(--surface-1)', backdropFilter: 'blur(16px)', borderColor: 'var(--border-primary)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: '600' }} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#incomeGrad)" />
                  <Area type="monotone" dataKey="expense" name="Expense" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#expenseGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut & Category breakdowns */}
          <div className="space-y-4">
            {/* Income by source */}
            <div className="rounded-2xl p-4 border border-border/80" style={{ background: 'var(--surface-2)' }}>
              <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Income by Source</span>
              <div className="h-32 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={incomePieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} dataKey="value">
                      {incomePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatCurrency(v), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {incomePieData.map((item, i) => (
                  <div key={item.name} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                    </div>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense breakdown */}
            <div className="rounded-2xl p-4 border border-border/80" style={{ background: 'var(--surface-2)' }}>
              <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Expense Breakdown</span>
              <div className="space-y-2.5 mt-3">
                {expensePieData.map((item, i) => {
                  const pct = totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(0) : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.value)} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
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
                <button key={f} onClick={() => setFilterType(f)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${filterType === f ? 'border-brand-500/40 bg-brand-500/20 text-brand-300' : 'border-transparent hover:bg-surface-2'}`} style={filterType !== f ? { color: 'var(--text-secondary)' } : {}}>
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
                  {['Date', 'Type', 'Category', 'Notes', 'Payment', 'Origin', 'Amount'].map(h => (
                    <th key={h} className="text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b border-border" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((tx: any) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
