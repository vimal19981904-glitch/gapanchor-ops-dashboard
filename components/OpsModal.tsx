'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Calendar, Plus, Trash2, Check, AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface ParticipantRow {
  participantName: string;
  amountDue: number | '';
  amountPaid: number | '';
  notes?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  sessionToEdit?: any | null;
  masterParticipantsList?: string[];
}

const parseInputNumber = (valStr: string): number | '' => {
  if (valStr === '') return '';
  const clean = valStr.replace(/^0+(?=\d)/, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? '' : parsed;
};

const TRAINER_MAPPING: Record<string, string> = {
  'Manhattan WMS': 'Arul Xavier',
  'Blue Yonder': 'Senior Supply Chain Specialist',
  'Blue Yonder (IDA)': 'Senior Supply Chain Specialist',
  'Kinaxis': 'Arul Xavier',
  'SAP S/4HANA': 'SAP Certified Principal',
};

const DEFAULT_MASTER = [
  'John Doe',
  'Jane Smith',
  'Mike Johnson',
  'Sarah Lee',
  'Tom Wilson',
  'Alex Turner',
  'David Miller',
  'Emma Davis',
  'Robert Taylor',
  'Sophia White',
];

export default function OpsModal({
  isOpen,
  onClose,
  onRefresh,
  sessionToEdit = null,
  masterParticipantsList = [],
}: Props) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('Manhattan WMS');
  const [trainer, setTrainer] = useState('Arul Xavier');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('Online Sandbox + Teams');
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [currentlyParticipating, setCurrentlyParticipating] = useState<number | ''>(0);
  const [trainerTotalCost, setTrainerTotalCost] = useState<number | ''>(90000);
  const [trainerAmountPaid, setTrainerAmountPaid] = useState<number | ''>(5000);
  const [trainerAmountDue, setTrainerAmountDue] = useState<number | ''>(85000);
  const [participantRows, setParticipantRows] = useState<ParticipantRow[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newParticipantInput, setNewParticipantInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);

  const availableMasterNames = Array.from(
    new Set([...DEFAULT_MASTER, ...masterParticipantsList])
  );

  const handleDeleteBatch = async () => {
    if (!sessionToEdit?.id) return;
    setDeletingSession(true);
    try {
      const res = await fetch(`/api/ops?id=${sessionToEdit.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Training batch session deleted & archived to purge log');
        setIsDeleteConfirmOpen(false);
        onRefresh();
        onClose();
      } else {
        toast.error(data.error || 'Failed to delete batch session');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error deleting batch session');
    } finally {
      setDeletingSession(false);
    }
  };


  // Synchronize initial state when modal opens or sessionToEdit changes
  useEffect(() => {
    if (sessionToEdit) {
      setTitle(sessionToEdit.title || '');
      setPlatform(sessionToEdit.platform || 'Manhattan WMS');
      setTrainer(sessionToEdit.trainer || TRAINER_MAPPING[sessionToEdit.platform] || 'Arul Xavier');
      setDate(
        sessionToEdit.date
          ? new Date(sessionToEdit.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
      setLocation(sessionToEdit.location || 'Online Sandbox + Teams');
      setCurrentlyParticipating(sessionToEdit.currentlyParticipating ?? 0);
      const tCost = sessionToEdit.trainerTotalCost ?? 90000;
      const tPaid = sessionToEdit.trainerAmountPaid ?? 5000;
      const tDue = sessionToEdit.trainerAmountDue ?? (tCost - tPaid);
      setTrainerTotalCost(tCost);
      setTrainerAmountPaid(tPaid);
      setTrainerAmountDue(tDue);

      if (sessionToEdit.participants && Array.isArray(sessionToEdit.participants)) {
        const rows = sessionToEdit.participants.map((p: any) => ({
          participantName: p.participantName,
          amountDue: p.amountDue ?? 5000,
          amountPaid: p.amountPaid ?? 0,
          notes: p.notes || '',
        }));
        setParticipantRows(rows);
        setTotalParticipants(rows.length || sessionToEdit.participantsCount || 0);
      } else {
        setParticipantRows([]);
        setTotalParticipants(sessionToEdit.participantsCount || 0);
      }
    } else {
      // Default Add Mode state - clean empty state for new session batch
      setTitle('');
      setPlatform('Manhattan WMS');
      setTrainer('Arul Xavier');
      setDate(new Date().toISOString().split('T')[0]);
      setLocation('Online Sandbox + Teams');
      setCurrentlyParticipating(0);
      setTrainerTotalCost('');
      setTrainerAmountPaid('');
      setTrainerAmountDue('');
      setParticipantRows([]);
      setTotalParticipants(0);
    }
  }, [sessionToEdit, isOpen]);


  const handlePlatformChange = (newPlatform: string) => {
    setPlatform(newPlatform);
    if (!trainer && TRAINER_MAPPING[newPlatform]) {
      setTrainer(TRAINER_MAPPING[newPlatform]);
    }
  };

  // Toggle participant from multi-select checkbox list
  const toggleParticipantName = (name: string) => {
    const exists = participantRows.some((r) => r.participantName === name);
    if (exists) {
      const updated = participantRows.filter((r) => r.participantName !== name);
      setParticipantRows(updated);
      setTotalParticipants(updated.length);
    } else {
      const updated = [
        ...participantRows,
        { participantName: name, amountDue: 5000, amountPaid: 0 },
      ];
      setParticipantRows(updated);
      setTotalParticipants(updated.length);
    }
  };

  // Add custom participant name
  const handleAddCustomParticipant = () => {
    if (!newParticipantInput.trim()) return;
    const cleanName = newParticipantInput.trim();
    if (!participantRows.some((r) => r.participantName === cleanName)) {
      const updated = [
        ...participantRows,
        { participantName: cleanName, amountDue: 5000, amountPaid: 0 },
      ];
      setParticipantRows(updated);
      setTotalParticipants(updated.length);
    }
    setNewParticipantInput('');
  };

  // Update participant payment details in table
  const updateRow = (index: number, field: keyof ParticipantRow, val: any) => {
    const updated = [...participantRows];
    updated[index] = { ...updated[index], [field]: val };
    setParticipantRows(updated);
  };

  // Remove row from table
  const removeRow = (index: number) => {
    const updated = participantRows.filter((_, i) => i !== index);
    setParticipantRows(updated);
    setTotalParticipants(updated.length);
  };

  // Calculate Status Pill
  const getStatusBadge = (dueVal: number | '', paidVal: number | '') => {
    const due = typeof dueVal === 'number' ? dueVal : 0;
    const paid = typeof paidVal === 'number' ? paidVal : 0;
    if (paid >= due && due > 0) {
      return {
        label: 'Paid',
        bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      };
    } else if (paid > 0 && paid < due) {
      return {
        label: 'Partial',
        bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      };
    } else {
      return {
        label: 'Pending',
        bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      };
    }
  };

  const tCostNum = typeof trainerTotalCost === 'number' ? trainerTotalCost : 0;
  const tPaidNum = typeof trainerAmountPaid === 'number' ? trainerAmountPaid : 0;
  const computedTrainerDue = Math.max(0, tCostNum - tPaidNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a session title');
      return;
    }

    const currentPart = typeof currentlyParticipating === 'number' ? currentlyParticipating : 0;
    if (currentPart > totalParticipants) {
      toast.error('Currently participating cannot exceed total participants count');
      return;
    }

    // Validate that amount paid does not exceed amount due
    for (const r of participantRows) {
      const rDue = typeof r.amountDue === 'number' ? r.amountDue : 0;
      const rPaid = typeof r.amountPaid === 'number' ? r.amountPaid : 0;
      if (rPaid > rDue) {
        toast.error(`Amount paid for ${r.participantName} cannot exceed amount due ($${rDue})`);
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        id: sessionToEdit?.id,
        title,
        platform,
        trainer,
        participantsCount: totalParticipants,
        currentlyParticipating: currentPart,
        date,
        location,
        trainerTotalCost: tCostNum,
        trainerAmountPaid: tPaidNum,
        trainerAmountDue: computedTrainerDue,
        participants: participantRows.map((r) => ({
          ...r,
          amountDue: typeof r.amountDue === 'number' ? r.amountDue : 0,
          amountPaid: typeof r.amountPaid === 'number' ? r.amountPaid : 0,
        })),
      };

      const method = sessionToEdit ? 'PUT' : 'POST';
      const res = await fetch('/api/ops', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(
          sessionToEdit
            ? 'Session & Payment Data Updated'
            : 'New Training Session & Payment Record Saved'
        );
        onRefresh();
        onClose();
      } else {
        toast.error(data.error || 'Failed to save session');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error saving session');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl border border-border p-5 sm:p-7 animate-slide-up my-auto shadow-2xl overflow-hidden"
        style={{ background: '#0b1329' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {sessionToEdit ? 'Edit Training & Finance Session' : 'Schedule Training & Finance Session'}
              </h3>
              <p className="text-[11px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Manual entry for training enrollment and participant payment status persistence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-surface-3 p-2 rounded-full transition-colors cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 3.1 Session Title */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Session Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Manhattan WMS Inbound Deep Dive"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* 3.2 Platform Selection & 3.3 Trainer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Platform <span className="text-rose-400">*</span>
              </label>
              <select
                value={platform}
                onChange={(e) => handlePlatformChange(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-cyan-500 transition-all cursor-pointer"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              >
                <option value="Manhattan WMS">Manhattan WMS</option>
                <option value="Blue Yonder">Blue Yonder (IDA)</option>
                <option value="Kinaxis">Kinaxis</option>
                <option value="SAP S/4HANA">SAP S/4HANA</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Trainer Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={trainer}
                onChange={(e) => setTrainer(e.target.value)}
                placeholder="e.g. Arul Xavier, Specialist Trainer"
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-cyan-500 font-semibold text-cyan-300 transition-all"
                style={{ background: 'var(--surface-2)' }}
              />
            </div>
          </div>


          {/* TRAINER FINANCIALS (MANUAL OVERALL & PAID; AUTO-CALC PAYABLE/DUE) */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                👨‍🏫 Trainer Financial Compensation (Manual Entry)
              </span>
              <span className="text-[10px] text-indigo-400 font-mono font-bold">
                Session Trainer Tracking
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 mb-1 block">
                  Trainer Overall Amount (₹ / $)
                </label>
                <input
                  type="number"
                  min="0"
                  value={trainerTotalCost === '' ? '' : trainerTotalCost}
                  onChange={(e) => setTrainerTotalCost(parseInputNumber(e.target.value))}
                  className="w-full rounded-xl border border-indigo-500/40 px-3 py-2 text-xs font-mono font-bold text-white bg-slate-900 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 mb-1 block">
                  Trainer Paid Amount (₹ / $)
                </label>
                <input
                  type="number"
                  min="0"
                  value={trainerAmountPaid === '' ? '' : trainerAmountPaid}
                  onChange={(e) => setTrainerAmountPaid(parseInputNumber(e.target.value))}
                  className="w-full rounded-xl border border-indigo-500/40 px-3 py-2 text-xs font-mono font-bold text-emerald-400 bg-slate-900 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 mb-1 block">
                  Trainer Payable / Due (Auto-calc)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`₹${computedTrainerDue.toLocaleString('en-IN')}`}
                  className="w-full rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-mono font-extrabold text-rose-400 bg-slate-900/90 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* 3.4 Participants Selection Dropdown */}

          <div className="relative">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold block" style={{ color: 'var(--text-secondary)' }}>
                Select Participants ({participantRows.length} selected)
              </label>
              <span className="text-[10px] text-cyan-400 font-semibold">
                Auto-updates table & counts below
              </span>
            </div>

            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm text-left flex items-center justify-between cursor-pointer transition-all hover:border-cyan-500/50"
              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            >
              <span className="truncate">
                {participantRows.length > 0
                  ? participantRows.map((r) => r.participantName).join(', ')
                  : 'Click to select participants from master list...'}
              </span>
              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold ml-2">
                {participantRows.length}
              </span>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border p-3 shadow-2xl z-50 animate-slide-up max-h-60 overflow-y-auto"
                style={{ background: '#0f172a' }}
              >
                <div className="flex gap-2 mb-2 pb-2 border-b border-border">
                  <input
                    type="text"
                    placeholder="Add custom participant name..."
                    value={newParticipantInput}
                    onChange={(e) => setNewParticipantInput(e.target.value)}
                    className="flex-1 rounded-lg border border-border px-2.5 py-1 text-xs outline-none focus:border-cyan-500"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomParticipant}
                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-1">
                  {availableMasterNames.map((name) => {
                    const selected = participantRows.some((r) => r.participantName === name);
                    return (
                      <label
                        key={name}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-800 cursor-pointer text-xs transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleParticipantName(name)}
                          className="rounded border-border text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className={selected ? 'font-bold text-white' : 'text-slate-300'}>
                          {name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3.5 Total Participants & 3.6 Currently Participating */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Total Participants
              </label>
              <input
                type="number"
                min="0"
                value={totalParticipants === 0 ? '0' : totalParticipants}
                onChange={(e) => setTotalParticipants(typeof parseInputNumber(e.target.value) === 'number' ? (parseInputNumber(e.target.value) as number) : 0)}
                className="w-full rounded-xl border border-border px-3.5 py-2 text-sm outline-none focus:border-cyan-500"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Currently Participating
              </label>
              <input
                type="number"
                min="0"
                max={totalParticipants}
                value={currentlyParticipating === '' ? '' : currentlyParticipating}
                onChange={(e) => setCurrentlyParticipating(parseInputNumber(e.target.value))}
                className="w-full rounded-xl border border-border px-3.5 py-2 text-sm outline-none focus:border-cyan-500"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Session Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2 text-sm outline-none focus:border-cyan-500"
                style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* 3.8 Location */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Location <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Online Sandbox + Teams, HYD Enterprise Center"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-cyan-500"
              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* 3.9 PAYMENT TRACKING TABLE (CRITICAL REQUIREMENT) */}
          <div className="pt-3 border-t border-border/60">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                💳 Payment Tracking For Participants ({participantRows.length})
              </h4>
              <span className="text-[10px] text-tertiary">
                Auto-calculated Balance & Status (Paid / Partial / Pending)
              </span>
            </div>

            {participantRows.length === 0 ? (
              <div
                className="p-6 text-center text-xs font-semibold rounded-2xl border border-dashed border-border"
                style={{ color: 'var(--text-tertiary)' }}
              >
                No participants added yet. Use the dropdown above to add participants to track payments.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr style={{ background: 'var(--surface-3)' }}>
                      <th className="px-3 py-2.5 font-bold uppercase text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        Participant
                      </th>
                      <th className="px-3 py-2.5 font-bold uppercase text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        Amount Due ($)
                      </th>
                      <th className="px-3 py-2.5 font-bold uppercase text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        Amount Paid ($)
                      </th>
                      <th className="px-3 py-2.5 font-bold uppercase text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        Balance ($)
                      </th>
                      <th className="px-3 py-2.5 font-bold uppercase text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        Status
                      </th>
                      <th className="px-2 py-2.5 text-center font-bold uppercase text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantRows.map((row, idx) => {
                      const dueNum = typeof row.amountDue === 'number' ? row.amountDue : 0;
                      const paidNum = typeof row.amountPaid === 'number' ? row.amountPaid : 0;
                      const balance = Math.max(0, dueNum - paidNum);
                      const statusBadge = getStatusBadge(row.amountDue, row.amountPaid);

                      return (
                        <tr
                          key={idx}
                          className="border-b border-border/40 hover:bg-surface-2/60 transition-colors"
                        >
                          <td className="px-3 py-2 font-bold" style={{ color: 'var(--text-primary)' }}>
                            {row.participantName}
                          </td>

                          {/* Amount Due */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={row.amountDue === '' ? '' : row.amountDue}
                              onChange={(e) =>
                                updateRow(idx, 'amountDue', parseInputNumber(e.target.value))
                              }
                              className="w-24 rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-cyan-500 font-mono"
                              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                            />
                          </td>

                          {/* Amount Paid */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={dueNum}
                              value={row.amountPaid === '' ? '' : row.amountPaid}
                              onChange={(e) =>
                                updateRow(idx, 'amountPaid', parseInputNumber(e.target.value))
                              }
                              className="w-24 rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-cyan-500 font-mono"
                              style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
                            />
                          </td>

                          {/* Balance */}
                          <td className="px-3 py-2 font-mono font-bold text-slate-300">
                            ${balance.toLocaleString()}
                          </td>

                          {/* Status Badge */}
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadge.bg}`}
                            >
                              {statusBadge.label}
                            </span>
                          </td>

                          {/* Remove */}
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remove participant"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <div>
              {sessionToEdit ? (
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete Batch Session</span>
                </button>
              ) : (
                <span className="text-[10px] text-tertiary">
                  * Direct database persistence on save
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-border hover:bg-surface-2 transition-all cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle size={15} />
                <span>{loading ? 'Saving to Database...' : 'Save Session'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Delete Batch Confirmation Dialog */}
        {isDeleteConfirmOpen && sessionToEdit && (
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-fade-in"
            onClick={() => !deletingSession && setIsDeleteConfirmOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-[#0c1222] p-6 shadow-2xl shadow-rose-950/80 animate-slide-up text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 pb-3 mb-4 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Confirm Batch Deletion
                  </h3>
                  <p className="text-xs text-slate-400">
                    Archival purge enabled • Permanent audit safety
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to permanently delete the training batch session{' '}
                  <strong className="text-white font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    "{sessionToEdit.title}"
                  </strong>
                  ?
                </p>

                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle size={13} /> Deletion Impact:
                  </p>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 opacity-90">
                    <li>Deletes all participant payment records for this batch session</li>
                    <li>Archives full session data to purge logs for historical reporting</li>
                    <li>Removes auto-synced revenue items from finance tracking</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  disabled={deletingSession}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDeleteBatch}
                  disabled={deletingSession}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-95 text-white shadow-lg shadow-rose-600/30 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {deletingSession ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting Batch...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Confirm Delete Batch</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

