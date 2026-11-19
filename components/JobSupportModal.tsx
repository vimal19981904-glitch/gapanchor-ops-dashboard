'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Calendar, Plus, Trash2, Check, AlertCircle, ShieldAlert, ChevronDown, ChevronUp, FileText, UserCheck, DollarSign, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

interface ClientParticipantRow {
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

const ENGINEER_MAPPING: Record<string, string> = {
  'Manhattan WMS': 'Employee A (Manhattan WMS)',
  'Manhattan ProActive': 'Arul Xavier',
  'AWS - Amazon Web Services': 'Senior Cloud Architect',
  'Cloud Architecture': 'Senior Cloud Architect',
  'Blue Yonder': 'Senior Supply Chain Specialist',
  'Oracle RMCS': 'Oracle Principal Specialist',
  'RedPrairie': 'WMS Specialist',
};

const DEFAULT_MASTER = [
  'Oladayo Olawepo',
  'Sakhr Tantaoui',
  'Divya Gupta',
  'sandra lopie',
  'sejal sawalkar',
  'Keerthi G',
  'Sudarsan Y',
  'Lokesh Prabhu',
  'Md Asif',
];

export default function JobSupportModal({
  isOpen,
  onClose,
  onRefresh,
  sessionToEdit = null,
  masterParticipantsList = [],
}: Props) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('Manhattan WMS');
  const [engineer, setEngineer] = useState('Employee A (Manhattan WMS)');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('Online Sandbox + Remote Access (Teams/AnyDesk)');
  const [totalParticipants, setTotalParticipants] = useState<number>(1);
  const [currentlyParticipating, setCurrentlyParticipating] = useState<number | ''>(1);
  const [engineerTotalCost, setEngineerTotalCost] = useState<number | ''>(45000);
  const [engineerAmountPaid, setEngineerAmountPaid] = useState<number | ''>(15000);
  const [engineerAmountDue, setEngineerAmountDue] = useState<number | ''>(30000);
  const [participantRows, setParticipantRows] = useState<ClientParticipantRow[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [newParticipantInput, setNewParticipantInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [generatingInvoiceIndex, setGeneratingInvoiceIndex] = useState<number | null>(null);

  const availableMasterNames = Array.from(
    new Set([...DEFAULT_MASTER, ...masterParticipantsList])
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (sessionToEdit) {
      setTitle(sessionToEdit.title || '');
      setPlatform(sessionToEdit.platform || 'Manhattan WMS');
      setEngineer(sessionToEdit.trainer || sessionToEdit.engineer || ENGINEER_MAPPING[sessionToEdit.platform] || 'Employee A (Manhattan WMS)');
      setDate(
        sessionToEdit.date
          ? new Date(sessionToEdit.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
      setLocation(sessionToEdit.location || 'Online Sandbox + Remote Access (Teams/AnyDesk)');
      setCurrentlyParticipating(sessionToEdit.currentlyParticipating ?? 1);
      const eCost = sessionToEdit.trainerTotalCost ?? sessionToEdit.engineerTotalCost ?? 45000;
      const ePaid = sessionToEdit.trainerAmountPaid ?? sessionToEdit.engineerAmountPaid ?? 15000;
      const eDue = sessionToEdit.trainerAmountDue ?? sessionToEdit.engineerAmountDue ?? (eCost - ePaid);
      setEngineerTotalCost(eCost);
      setEngineerAmountPaid(ePaid);
      setEngineerAmountDue(eDue);

      if (sessionToEdit.participants && Array.isArray(sessionToEdit.participants)) {
        const rows = sessionToEdit.participants.map((p: any) => ({
          participantName: p.participantName || p.name || 'Client',
          amountDue: p.amountDue ?? 75000,
          amountPaid: p.amountPaid ?? 25000,
          notes: p.notes || '',
        }));
        setParticipantRows(rows);
        setTotalParticipants(rows.length || sessionToEdit.participantsCount || 1);
      } else {
        setParticipantRows([
          {
            participantName: sessionToEdit.clientName || sessionToEdit.participantName || 'Client Engagement',
            amountDue: 75000,
            amountPaid: 25000,
            notes: '1-on-1 Dedicated Support',
          },
        ]);
        setTotalParticipants(sessionToEdit.participantsCount || 1);
      }
    } else {
      // Default Add Mode
      setTitle('');
      setPlatform('Manhattan WMS');
      setEngineer('Employee A (Manhattan WMS)');
      setDate(new Date().toISOString().split('T')[0]);
      setLocation('Online Sandbox + Remote Access (Teams/AnyDesk)');
      setCurrentlyParticipating(1);
      setEngineerTotalCost(45000);
      setEngineerAmountPaid(0);
      setEngineerAmountDue(45000);
      setParticipantRows([
        {
          participantName: '',
          amountDue: 75000,
          amountPaid: 0,
          notes: '1-on-1 Support Client',
        }
      ]);
      setTotalParticipants(1);
    }
  }, [sessionToEdit, isOpen]);

  const handlePlatformChange = (newPlatform: string) => {
    setPlatform(newPlatform);
    if (ENGINEER_MAPPING[newPlatform]) {
      setEngineer(ENGINEER_MAPPING[newPlatform]);
    }
  };

  const handleEngineerCostChange = (totalVal: number | '', paidVal: number | '') => {
    const t = typeof totalVal === 'number' ? totalVal : 0;
    const p = typeof paidVal === 'number' ? paidVal : 0;
    setEngineerTotalCost(totalVal);
    setEngineerAmountPaid(paidVal);
    setEngineerAmountDue(Math.max(0, t - p));
  };

  const handleParticipantChange = (index: number, field: keyof ClientParticipantRow, value: any) => {
    const updated = [...participantRows];
    updated[index] = { ...updated[index], [field]: value };
    setParticipantRows(updated);
  };

  const handleAddParticipant = (name: string) => {
    if (!name.trim()) return;
    if (participantRows.some(r => r.participantName.toLowerCase() === name.trim().toLowerCase())) {
      toast.error('Client already added to session.');
      return;
    }
    const newRow: ClientParticipantRow = {
      participantName: name.trim(),
      amountDue: 75000,
      amountPaid: 0,
      notes: '1-on-1 Support Client',
    };
    const updated = [...participantRows, newRow];
    setParticipantRows(updated);
    setTotalParticipants(updated.length);
    setNewParticipantInput('');
    setDropdownOpen(false);
  };

  const handleRemoveParticipant = (index: number) => {
    const updated = participantRows.filter((_, i) => i !== index);
    setParticipantRows(updated);
    setTotalParticipants(updated.length);
  };

  const handleGenerateInvoice = async (row: ClientParticipantRow, idx: number) => {
    setGeneratingInvoiceIndex(idx);
    try {
      const due = typeof row.amountDue === 'number' ? row.amountDue : 0;
      const paid = typeof row.amountPaid === 'number' ? row.amountPaid : 0;

      const response = await fetch('/api/finance/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: row.participantName,
          topic: title || `${platform} 1-on-1 Job Support`,
          amountDue: due,
          amountPaid: paid,
          invoiceDate: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GapAnchor_JobSupport_Invoice_${row.participantName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Job Support Invoice downloaded for ${row.participantName}!`);
    } catch (err: any) {
      toast.error(err.message || 'Error generating invoice');
    } finally {
      setGeneratingInvoiceIndex(null);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToEdit?.id) return;
    setDeletingSession(true);
    try {
      const res = await fetch(`/api/job-support/session?id=${sessionToEdit.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Job Support Engagement session deleted successfully');
        setIsDeleteConfirmOpen(false);
        onRefresh();
        onClose();
      } else {
        toast.error(data.error || 'Failed to delete engagement session');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error deleting engagement session');
    } finally {
      setDeletingSession(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Engagement Title is required');
      return;
    }
    setLoading(true);

    try {
      const payload = {
        id: sessionToEdit?.id,
        title: title.trim(),
        platform,
        trainer: engineer,
        engineer,
        date,
        location,
        participantsCount: totalParticipants,
        currentlyParticipating: typeof currentlyParticipating === 'number' ? currentlyParticipating : 0,
        trainerTotalCost: typeof engineerTotalCost === 'number' ? engineerTotalCost : 0,
        trainerAmountPaid: typeof engineerAmountPaid === 'number' ? engineerAmountPaid : 0,
        trainerAmountDue: typeof engineerAmountDue === 'number' ? engineerAmountDue : 0,
        participants: participantRows,
      };

      const method = sessionToEdit?.id ? 'PUT' : 'POST';
      const res = await fetch('/api/job-support/session', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(sessionToEdit?.id ? 'Job Support Session updated!' : 'Job Support Session created!');
        onRefresh();
        onClose();
      } else {
        toast.error(data.error || 'Failed to save Job Support session');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error saving session');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/60 sm:border-amber-500/30 rounded-2xl p-3.5 sm:p-5 md:p-7 max-w-3xl w-full shadow-2xl relative my-2 sm:my-8 space-y-3 sm:space-y-4">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 sm:pb-3.5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-extrabold text-white leading-tight">
                {sessionToEdit ? 'Edit Job Support & Finance' : 'New Job Support & Finance'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3.5">
          {/* Engagement Title */}
          <div>
            <label className="block text-[10.5px] sm:text-xs font-bold text-slate-300 mb-1">
              Session / Engagement Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cloud Architecture Online Job Support - [Oladayo Olawepo]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-8 sm:h-9 px-2.5 sm:px-3 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          {/* Platform & Engineer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-[10.5px] sm:text-xs font-bold text-slate-300 mb-1">
                Target Platform <span className="text-rose-400">*</span>
              </label>
              <select
                value={platform}
                onChange={(e) => handlePlatformChange(e.target.value)}
                className="w-full h-8 sm:h-9 px-2.5 sm:px-3 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/60 cursor-pointer"
              >
                <option value="Manhattan WMS">Manhattan WMS</option>
                <option value="Manhattan ProActive">Manhattan ProActive</option>
                <option value="AWS - Amazon Web Services">AWS - Amazon Web Services</option>
                <option value="Cloud Architecture">Cloud Architecture</option>
                <option value="Blue Yonder">Blue Yonder (JDA)</option>
                <option value="Oracle RMCS">Oracle RMCS</option>
                <option value="RedPrairie">RedPrairie</option>
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] sm:text-xs font-bold text-slate-300 mb-1">
                Assigned Support Engineer <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Engineer Name"
                value={engineer}
                onChange={(e) => setEngineer(e.target.value)}
                className="w-full h-8 sm:h-9 px-2.5 sm:px-3 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          {/* ENGINEER FINANCIAL COMPENSATION SECTION */}
          <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 border border-amber-500/30 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black tracking-wider text-amber-300 uppercase">
                Engineer Financial Compensation
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
              <div>
                <label className="block text-[9.5px] sm:text-[11px] font-semibold text-slate-400 mb-0.5 truncate">
                  Overall (₹)
                </label>
                <input
                  type="text"
                  placeholder="45000"
                  value={engineerTotalCost}
                  onChange={(e) => handleEngineerCostChange(parseInputNumber(e.target.value), engineerAmountPaid)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-700/60 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[9.5px] sm:text-[11px] font-semibold text-slate-400 mb-0.5 truncate">
                  Paid (₹)
                </label>
                <input
                  type="text"
                  placeholder="15000"
                  value={engineerAmountPaid}
                  onChange={(e) => handleEngineerCostChange(engineerTotalCost, parseInputNumber(e.target.value))}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-700/60 rounded-lg text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[9.5px] sm:text-[11px] font-semibold text-slate-400 mb-0.5 truncate">
                  Payable / Due
                </label>
                <div className="w-full h-8 px-2 flex items-center bg-slate-950 border border-rose-500/30 rounded-lg text-xs font-mono font-black text-rose-400 truncate">
                  ₹ {typeof engineerAmountDue === 'number' ? engineerAmountDue.toLocaleString() : '0'}
                </div>
              </div>
            </div>
          </div>

          {/* CLIENT SELECTION & DETAILS */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] sm:text-xs font-bold text-slate-300">
                Client / Participant Selection ({participantRows.length} selected)
              </label>
              <span className="text-[10px] text-brand-400">Auto-updates table & counts below</span>
            </div>

            <div ref={dropdownRef} className="relative">
              <input
                type="text"
                placeholder="Search or enter client participant name…"
                value={newParticipantInput}
                onChange={(e) => {
                  setNewParticipantInput(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddParticipant(newParticipantInput);
                  }
                }}
                className="w-full h-8 sm:h-9 px-2.5 sm:px-3 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />

              {dropdownOpen && availableMasterNames.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl divide-y divide-slate-800">
                  {availableMasterNames
                    .filter((n) => n.toLowerCase().includes(newParticipantInput.toLowerCase()))
                    .map((name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => handleAddParticipant(name)}
                        className="w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-amber-500/20 hover:text-white flex items-center justify-between"
                      >
                        <span>{name}</span>
                        <Plus className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Session Metrics */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <div>
              <label className="block text-[9.5px] sm:text-[11px] font-semibold text-slate-300 mb-0.5 truncate">Total Clients</label>
              <input
                type="number"
                disabled
                value={totalParticipants}
                className="w-full h-8 px-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-400"
              />
            </div>

            <div>
              <label className="block text-[9.5px] sm:text-[11px] font-semibold text-slate-300 mb-0.5 truncate">Active</label>
              <input
                type="text"
                value={currentlyParticipating}
                onChange={(e) => setCurrentlyParticipating(parseInputNumber(e.target.value))}
                className="w-full h-8 px-2 bg-slate-950 border border-slate-700/60 rounded-lg text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-[9.5px] sm:text-[11px] font-semibold text-slate-300 mb-0.5 truncate">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-8 px-1 sm:px-2 bg-slate-950 border border-slate-700/60 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          {/* Location / Sandbox */}
          <div>
            <label className="block text-[10.5px] sm:text-xs font-bold text-slate-300 mb-1">Support Mode & Location *</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-8 sm:h-9 px-2.5 sm:px-3 bg-slate-950 border border-slate-700/60 rounded-xl text-xs text-white"
            />
          </div>

          {/* PAYMENT TRACKING TABLE FOR PARTICIPANTS */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
            <button
              type="button"
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900/80 flex items-center justify-between text-xs font-bold text-amber-300 border-b border-slate-800"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] sm:text-xs">PAYMENT TRACKING FOR CLIENTS ({participantRows.length})</span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  Paid: {participantRows.filter(r => (typeof r.amountPaid === 'number' && r.amountPaid >= (r.amountDue || 0))).length}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                  Pending: {participantRows.filter(r => (!r.amountPaid || (typeof r.amountPaid === 'number' && r.amountPaid < (r.amountDue || 0)))).length}
                </span>
              </div>
              {isTableExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>

            {isTableExpanded && (
              <div className="divide-y divide-slate-800/70">
                {participantRows.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No clients added yet. Add a client above.</p>
                ) : (
                  participantRows.map((row, idx) => (
                    <div key={idx} className="p-2.5 sm:p-3 grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-3 items-center hover:bg-slate-900/40 transition-colors">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-semibold mb-0.5">Client Name</span>
                        <input
                          type="text"
                          value={row.participantName}
                          onChange={(e) => handleParticipantChange(idx, 'participantName', e.target.value)}
                          className="w-full h-8 bg-slate-900 border border-slate-700/60 rounded-lg px-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500/60"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 md:contents">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block font-semibold mb-0.5">Amount Due (₹)</span>
                          <input
                            type="text"
                            value={row.amountDue}
                            onChange={(e) => handleParticipantChange(idx, 'amountDue', parseInputNumber(e.target.value))}
                            className="w-full h-8 bg-slate-900 border border-slate-700/60 rounded-lg px-2.5 text-xs text-rose-400 font-mono font-bold focus:outline-none focus:border-amber-500/60"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 uppercase block font-semibold mb-0.5">Amount Paid (₹)</span>
                          <input
                            type="text"
                            value={row.amountPaid}
                            onChange={(e) => handleParticipantChange(idx, 'amountPaid', parseInputNumber(e.target.value))}
                            className="w-full h-8 bg-slate-900 border border-slate-700/60 rounded-lg px-2.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-500/60"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 md:pt-4">
                        <button
                          type="button"
                          onClick={() => handleGenerateInvoice(row, idx)}
                          disabled={generatingInvoiceIndex === idx}
                          className="flex-1 inline-flex items-center justify-center gap-1 h-8 px-2.5 bg-white/[0.04] text-slate-200 border border-white/15 hover:bg-white/[0.08] hover:border-white/25 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm active:scale-95"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>Invoice</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(idx)}
                          className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/30 transition-colors shrink-0"
                          title="Remove client"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-2.5 border-t border-slate-800">
            <div className={`grid ${sessionToEdit?.id ? 'grid-cols-3' : 'grid-cols-2'} gap-2 w-full sm:flex sm:items-center sm:justify-between`}>
              {sessionToEdit?.id ? (
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="h-8 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/15 text-xs font-bold transition-all cursor-pointer active:scale-95 inline-flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Delete</span>
                </button>
              ) : <div className="hidden sm:block" />}

              <div className={`contents sm:flex sm:items-center sm:gap-2.5 ${!sessionToEdit?.id ? 'col-span-2 sm:col-span-1 sm:ml-auto' : ''}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/15 text-xs font-bold transition-all cursor-pointer active:scale-95 inline-flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cancel</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="h-8 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/15 text-xs font-bold transition-all cursor-pointer active:scale-95 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>{loading ? 'Saving…' : 'Save'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-5 max-w-md w-full space-y-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-rose-400" />
                <h3 className="text-base font-bold text-white">Delete Job Support Engagement?</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">{title}</strong>? This will permanently remove the engagement record and archive it.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSession}
                  disabled={deletingSession}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs text-white font-extrabold"
                >
                  {deletingSession ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
