'use client';

import React, { useState } from 'react';
import { X, DollarSign, Calculator, User, Users, BookOpen, Percent, Calendar, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface AddCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCollectionModal({ isOpen, onClose, onSuccess }: AddCollectionModalProps) {
  const [clientName, setClientName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [trainerName, setTrainerName] = useState('Arul Xavier');
  const [amountCollected, setAmountCollected] = useState<number | ''>(20000);
  const [trainerPercentage, setTrainerPercentage] = useState<number>(50);
  const [trainerPaid, setTrainerPaid] = useState<number | ''>(5000);
  const [operatingExpense, setOperatingExpense] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const collected = typeof amountCollected === 'number' ? amountCollected : 0;
  const paid = typeof trainerPaid === 'number' ? trainerPaid : 0;
  const ops = typeof operatingExpense === 'number' ? operatingExpense : 0;

  // Auto-calculated fields
  const trainerTotalCost = Math.round(collected * (trainerPercentage / 100));
  const trainerPayable = Math.max(0, trainerTotalCost - paid);
  const grossMargin = collected - trainerTotalCost;
  const netProfit = grossMargin - ops;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error('Please enter a client name');
      return;
    }
    if (collected <= 0) {
      toast.error('Please enter a valid collection amount');
      return;
    }

    setSubmitting(true);
    try {
      // Record transaction via API
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'income',
          sourceOrCategory: 'Training Fees',
          platform: batchName || 'General Training',
          amount: collected,
          paymentMethod: 'Bank Transfer',
          notes: `Client: ${clientName} | Trainer: ${trainerName} (Cost: ₹${trainerTotalCost}, Paid: ₹${paid}, Owed: ₹${trainerPayable}) | ${notes}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Client collection of ${formatCurrency(collected)} recorded successfully!`);
        onSuccess();
        onClose();
      } else {
        toast.error(json.error || 'Failed to record transaction');
      }
    } catch (err: any) {
      toast.error('Network error saving transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl bg-[#0f172a] border border-slate-700 shadow-2xl p-6 space-y-5 text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Record Training Business Transaction</h3>
              <p className="text-xs text-slate-400">Auto-calculates Trainer Cost, Payable, Margin, and Profit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Client Name *</label>
              <input
                type="text"
                placeholder="e.g. Acme Logistics Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Batch / Program Name</label>
              <input
                type="text"
                placeholder="e.g. Batch 3 - Manhattan WMS"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Trainer Name</label>
              <input
                type="text"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Amount Collected (₹) *</label>
              <input
                type="number"
                value={amountCollected}
                onChange={(e) => setAmountCollected(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Trainer Share (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={trainerPercentage}
                onChange={(e) => setTrainerPercentage(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Trainer Amount Paid So Far (₹)</label>
              <input
                type="number"
                value={trainerPaid}
                onChange={(e) => setTrainerPaid(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Auto Calculation Live Breakdown Box */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2 text-xs">
            <span className="font-extrabold text-indigo-300 uppercase tracking-wider block text-[10px]">
              Live Automated Calculations
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Trainer Cost</span>
                <span className="font-bold text-amber-300 text-sm">{formatCurrency(trainerTotalCost)}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Trainer Payable</span>
                <span className="font-bold text-rose-400 text-sm">{formatCurrency(trainerPayable)}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">My Gross Margin</span>
                <span className="font-bold text-indigo-300 text-sm">{formatCurrency(grossMargin)}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Net Profit</span>
                <span className="font-bold text-emerald-300 text-sm">{formatCurrency(netProfit)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-indigo-500/20"
            >
              {submitting ? 'Saving Entry...' : 'Save Financial Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
