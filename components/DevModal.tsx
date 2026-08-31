'use client';

import React, { useState } from 'react';
import { X, CheckCircle, Code2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { isOpen: boolean; onClose: () => void; onRefresh: () => void; }

export default function DevModal({ isOpen, onClose, onRefresh }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('feature');
  const [description, setDescription] = useState('');
  const [shippedBy, setShippedBy] = useState('Antigravity Team');
  const [quarter, setQuarter] = useState('Q3 2026');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, description, shippedBy, quarter }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Dev log entry saved');
        onRefresh();
        onClose();
        setTitle('');
        setDescription('');
      } else { toast.error(data.error); }
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border p-7 animate-slide-up" style={{ background: 'var(--surface-1)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center"><Code2 size={18} /></div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Log Shipped Feature</h3>
          </div>
          <button onClick={onClose} className="hover:bg-surface-2 p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. WhatsApp Stale Alert System" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                <option value="feature">Feature</option><option value="fix">Fix / Refactor</option><option value="infra">Infrastructure</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Quarter</label>
              <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                <option>Q3 2026</option><option>Q4 2026</option><option>Q2 2026</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was built, fixed, or deployed..." className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 resize-none" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Shipped By</label>
            <input type="text" value={shippedBy} onChange={(e) => setShippedBy(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary"><CheckCircle size={15} />{loading ? 'Saving...' : 'Save Log'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
