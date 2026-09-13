'use client';

import React from 'react';
import { X, Layers, FileText, ArrowRight, Tag } from 'lucide-react';
import { CategoryData } from '@/hooks/useExpenseData';
import { formatCurrency, formatDate } from '@/lib/utils';
import { expenseDashboardTheme } from '@/config/dashboardTheme';

interface CategoryDrillDownModalProps {
  category: CategoryData | null;
  onClose: () => void;
}

export default function CategoryDrillDownModal({ category, onClose }: CategoryDrillDownModalProps) {
  if (!category) return null;

  const categoryConfig =
    (expenseDashboardTheme.colors.categories as Record<string, any>)[category.name] ||
    expenseDashboardTheme.colors.categories['Other Expenses'];

  const avgAmount = category.count > 0 ? category.amount / category.count : category.amount;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border bg-[#0b1329] p-6 shadow-2xl animate-slide-up text-white overflow-hidden max-h-[85vh] flex flex-col"
        style={{ borderColor: categoryConfig.borderAlpha || 'rgba(148, 163, 184, 0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold"
              style={{
                background: `linear-gradient(135deg, ${categoryConfig.solid}, ${categoryConfig.stroke})`,
                boxShadow: `0 0 15px ${categoryConfig.solid}66`,
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{category.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {category.percentage}% of Expense
                </span>
              </h3>
              <p className="text-xs text-slate-400">Category Drill-Down & Statement Analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 my-4 shrink-0">
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">Total Allocated</span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-400">
              {formatCurrency(category.amount)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">Statement Count</span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-cyan-300">
              {category.count} Transactions
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">Average Value</span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-purple-300">
              {formatCurrency(avgAmount)}
            </span>
          </div>
        </div>

        {/* Statement Transactions List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
            <span>Statement Transactions ({category.transactions.length})</span>
            <span className="text-[10px] text-slate-500 font-normal">Sourced from Account_Statement.xlsx</span>
          </div>

          {category.transactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
              No individual transactions linked for this category aggregate.
            </div>
          ) : (
            category.transactions.map((tx: any, idx: number) => (
              <div
                key={tx.id || idx}
                className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-slate-800/60 text-slate-400 shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200 truncate" title={tx.notes}>
                      {tx.notes || tx.sourceOrCategory || 'Statement Debit Record'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                      <span>{formatDate(tx.date)}</span>
                      <span>•</span>
                      <span>{tx.paymentMethod || 'UPI'}</span>
                    </div>
                  </div>
                </div>

                <span className="font-bold font-mono text-rose-400 shrink-0 text-sm">
                  -{formatCurrency(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
          >
            Close Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
}
