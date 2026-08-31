'use client';

import React, { useState } from 'react';
import { X, CheckCircle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function FinanceModal({ isOpen, onClose, onRefresh }: Props) {
  const [type, setType] = useState('income');
  const [sourceOrCategory, setSourceOrCategory] = useState('Training Fees');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, sourceOrCategory, amount: parseFloat(amount), paymentMethod, notes, date }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Transaction saved to database');
        onRefresh();
        onClose();
        setAmount('');
        setNotes('');
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border p-7 animate-slide-up" style={{ background: 'var(--surface-1)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Manual Payment Entry</h3>
          </div>
          <button onClick={onClose} className="hover:bg-surface-2 p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select value={type} onChange={(e) => { setType(e.target.value); setSourceOrCategory(e.target.value === 'income' ? 'Training Fees' : 'Marketing'); }} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                <option value="income">Income (+ Received)</option>
                <option value="expense">Expense (- Paid)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
              <input type="number" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 150000" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Category</label>
              <select value={sourceOrCategory} onChange={(e) => setSourceOrCategory(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                {type === 'income' ? (
                  <>
                    <option value="Training Fees">Training Fees</option>
                    <option value="Consulting">Consulting / Audit</option>
                    <option value="Corporate Cohort">Corporate Cohort</option>
                    <option value="Other Income">Other Income</option>
                  </>
                ) : (
                  <>
                    <option value="Marketing">Marketing / Ads</option>
                    <option value="Infrastructure">Cloud Infra / Labs</option>
                    <option value="Software">Software & SaaS</option>
                    <option value="Ops">Training Ops & Venue</option>
                    <option value="Misc">Misc Expenses</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                <option value="UPI">UPI (GPay / PhonePe)</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transaction reference or description..." className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              <CheckCircle size={15} />
              {loading ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
