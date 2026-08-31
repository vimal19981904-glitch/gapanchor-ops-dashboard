'use client';

import React, { useState } from 'react';
import { X, CheckCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface Props { isOpen: boolean; onClose: () => void; onRefresh: () => void; }

export default function OpsModal({ isOpen, onClose, onRefresh }: Props) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('Manhattan WMS');
  const [trainer, setTrainer] = useState('Arul Xavier');
  const [participantsCount, setParticipantsCount] = useState('25');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('Online Sandbox + Teams');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, platform, trainer, participantsCount, date, location }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Training session scheduled');
        onRefresh();
        onClose();
        setTitle('');
      } else { toast.error(data.error); }
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border p-7 animate-slide-up" style={{ background: 'var(--surface-1)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-500/15 text-brand-400 flex items-center justify-center"><Calendar size={18} /></div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Schedule Training Session</h3>
          </div>
          <button onClick={onClose} className="hover:bg-surface-2 p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Session Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Manhattan WMS Inbound Deep Dive" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
                <option>Manhattan WMS</option><option>Blue Yonder</option><option>Kinaxis</option><option>SAP S/4HANA</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Trainer</label>
              <input type="text" value={trainer} onChange={(e) => setTrainer(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Participants</label>
              <input type="number" value={participantsCount} onChange={(e) => setParticipantsCount(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand-500" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary"><CheckCircle size={15} />{loading ? 'Saving...' : 'Save Session'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
