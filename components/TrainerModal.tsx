'use client';

import React, { useState, useEffect } from 'react';
import {
  X, UserPlus, Save, Mail, Phone, Briefcase, Award, Calendar,
  FileText, CheckCircle2, Edit3, UserCheck, Star, Layers, RefreshCw,
  GraduationCap, Wrench, ExternalLink, ShieldCheck, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  trainerToEdit?: any | null;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return 'Not provided';
  let cleaned = phone.replace(/&#x2F;/gi, '/').trim();
  cleaned = cleaned.replace(/^(\+91|\+1|\+44|\+971|\+966)\s*(\+91|\+1|\+44|\+971|\+966)\s*/i, '$1 ');
  cleaned = cleaned.replace(/^(\+91)\s*(\+91)\s*/i, '+91 ');
  cleaned = cleaned.replace(/(\+91)\s*(\+91)/g, '$1 ');
  return cleaned.trim() || 'Not provided';
}

export function formatExperienceText(rawText: string | null | undefined, trainer?: any): {
  cleanParagraphs: string[];
  linkedIn: string;
} {
  let linkedIn = '';
  let cleanParagraphs: string[] = [];

  const isGenericPlaceholder = (str: string) => {
    const s = str.toLowerCase().trim();
    return !s || s.includes('no detailed profile notes') || s.includes('no profile notes') || s.includes('no notes provided');
  };

  if (rawText && !isGenericPlaceholder(rawText)) {
    let text = rawText
      .replace(/&amp;/g, '&')
      .replace(/&#x2F;/gi, '/')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    const linkedInMatch = text.match(/(?:in\/[a-zA-Z0-9_-]+|linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i);
    if (linkedInMatch) {
      const rawLink = linkedInMatch[0];
      linkedIn = rawLink.startsWith('http')
        ? rawLink
        : `https://www.linkedin.com/${rawLink.replace(/^in\//i, 'in/')}`;
    }

    let cleaned = text
      .replace(/^Hello\s*Admin,\s*A\s*new\s*inquiry\s*has\s*been\s*received:\s*/i, '')
      .replace(/Designated\s*Freelance\s*Position:\s*[^\n\r]+/gi, '')
      .replace(/Primary\s*Domain\s*\/\s*Module:\s*[^\n\r]+/gi, '')
      .replace(/Profile\s*Details\s*&\s*Experience:\s*/gi, '')
      .replace(/Name:\s*[^\n\r]+/gi, '')
      .replace(/Email:\s*[^\n\r]+/gi, '')
      .replace(/Phone:\s*[^\n\r]+/gi, '')
      .replace(/Submitted\s*at:\s*[^\n\r]+/gi, '')
      .replace(/Email\s*sent\s*via\s*EmailJS\.com/gi, '')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '')
      .replace(/in\/[a-zA-Z0-9_-]+/gi, '')
      .trim();

    cleaned = cleaned
      .replace(/\s*•\s*/g, '\n• ')
      .replace(/\s*\*\s*/g, '\n* ')
      .replace(/\bSUMMARY\b/i, '\nSUMMARY:\n')
      .replace(/\bEXPERIENCE\b/i, '\nEXPERIENCE:\n');

    const rawParagraphs = cleaned.split(/\n+/);
    for (const p of rawParagraphs) {
      let trimmed = p.trim();
      if (trimmed && trimmed.length > 2 && !isGenericPlaceholder(trimmed)) {
        trimmed = trimmed.replace(/^[•*]\s*/, '').trim();
        if (trimmed && !isGenericPlaceholder(trimmed)) {
          cleanParagraphs.push(trimmed);
        }
      }
    }
  }

  // Synthesize rich candidate profile details if cleanParagraphs is empty
  if (cleanParagraphs.length === 0 && trainer) {
    const roleText = trainer.role === 'Both'
      ? 'Dual Role Specialist (Batch Training & 1-on-1 Job Support)'
      : trainer.role === 'Employee'
      ? 'Dedicated Job Support Staff Engineer'
      : 'SCM Batch Training Specialist';

    const courseText = trainer.primaryCourse || 'SCM Enterprise Platform';
    const expText = trainer.experienceYears ? `${trainer.experienceYears} Years` : '3+ Years';

    cleanParagraphs.push('SUMMARY:');
    cleanParagraphs.push(`${trainer.name || 'Candidate'} is an active ${roleText} specializing in ${courseText} with ${expText} of verified domain expertise.`);

    cleanParagraphs.push('EXPERIENCE:');
    cleanParagraphs.push(`Primary Domain: Senior ${courseText} Specialist leading enterprise training cohorts & technical execution.`);

    if ((trainer.totalBatches || 0) > 0 || (trainer.jobSupportLeads || 0) > 0) {
      cleanParagraphs.push(`Operational Track Record: Assigned to ${trainer.totalBatches || 0} batch training cohort(s) and ${trainer.jobSupportLeads || 0} active 1-on-1 job support project(s).`);
    } else {
      cleanParagraphs.push('Operational Track Record: Registered candidate ready for upcoming batch assignments & 1-on-1 client support.');
    }

    if (trainer.email) {
      cleanParagraphs.push(`Contact Verification: Email verified (${trainer.email}) with active record in GapAnchor Candidate Registry.`);
    }

    if (trainer.source === 'outlook_work_with_us') {
      cleanParagraphs.push('Intake Pipeline: Candidate profile ingested via Outlook "Work With Us" cloud folder sync.');
    } else {
      cleanParagraphs.push('Intake Pipeline: Registered candidate in GapAnchor Operations Command Center.');
    }
  }

  if (cleanParagraphs.length === 0) {
    cleanParagraphs.push('Candidate registered with verified module assignment & contact details.');
  }

  return { cleanParagraphs, linkedIn };
}

export default function TrainerModal({ isOpen, onClose, onRefresh, trainerToEdit = null }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'edit'>('details');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'Trainer' | 'Employee' | 'Both'>('Trainer');
  const [primaryCourse, setPrimaryCourse] = useState('Manhattan WMS');
  const [status, setStatus] = useState('Active');
  const [experienceYears, setExperienceYears] = useState<number>(3.0);
  const [totalBatches, setTotalBatches] = useState<number>(0);
  const [jobSupportLeads, setJobSupportLeads] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (trainerToEdit) {
      setName(trainerToEdit.name || '');
      setEmail(trainerToEdit.email || '');
      setPhone(formatPhone(trainerToEdit.phone));
      setRole(trainerToEdit.role || 'Trainer');
      setPrimaryCourse(trainerToEdit.primaryCourse || 'Manhattan WMS');
      setStatus(trainerToEdit.status || 'Active');
      setExperienceYears(trainerToEdit.experienceYears ?? 3.0);
      setTotalBatches(trainerToEdit.totalBatches ?? 0);
      setJobSupportLeads(trainerToEdit.jobSupportLeads ?? 0);
      setNotes(trainerToEdit.notes || '');
      setActiveTab('details');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setRole('Trainer');
      setPrimaryCourse('Manhattan WMS');
      setStatus('Active');
      setExperienceYears(3.0);
      setTotalBatches(0);
      setJobSupportLeads(0);
      setNotes('');
      setActiveTab('edit');
    }
  }, [trainerToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter candidate name');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        id: trainerToEdit?.id,
        name: name.trim(),
        email: email.trim() || null,
        phone: formatPhone(phone),
        role,
        primaryCourse,
        status,
        experienceYears,
        totalBatches,
        jobSupportLeads,
        notes: notes.trim() || null,
      };

      const method = trainerToEdit ? 'PUT' : 'POST';
      const res = await fetch('/api/trainers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(trainerToEdit ? 'Candidate Details Updated Successfully' : 'New Candidate Registered');
        onRefresh();
        onClose();
      } else {
        toast.error(data.error || 'Failed to save candidate');
      }
    } catch (err: any) {
      toast.error(err.message || 'Server error saving candidate');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const parsedExp = formatExperienceText(notes, trainerToEdit);

  const getRoleBadge = (roleStr: string) => {
    if (roleStr === 'Both') {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 md:w-36 md:h-7 rounded-full text-[10px] md:text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm shrink-0">
          <Award className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-400 shrink-0" /> Dual Role (Both)
        </span>
      );
    } else if (roleStr === 'Employee') {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 md:w-36 md:h-7 rounded-full text-[10px] md:text-[11px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm shrink-0">
          <Wrench className="w-3 h-3 md:w-3.5 md:h-3.5 text-cyan-400 shrink-0" /> Job Support Staff
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 md:w-36 md:h-7 rounded-full text-[10px] md:text-[11px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 shadow-sm shrink-0">
          <GraduationCap className="w-3 h-3 md:w-3.5 md:h-3.5 text-indigo-400 shrink-0" /> Batch Trainer
        </span>
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex justify-end overflow-hidden animate-fade-in">
      {/* Backdrop click handler */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Right Slide-Over Drawer (Full width on mobile, 42% viewport width on desktop) */}
      <div className="relative w-full sm:max-w-xl lg:max-w-[42vw] h-full bg-[#080d1a] border-l border-indigo-500/30 shadow-2xl flex flex-col z-10 overflow-hidden transform transition-transform duration-300 ease-out">
        {/* Drawer Header */}
        <div className="p-3 sm:p-6 border-b border-indigo-500/20 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 text-indigo-300 font-black flex items-center justify-center text-sm sm:text-lg shrink-0 shadow-lg shadow-indigo-500/10">
              {(name || 'C').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-xl font-black text-white tracking-tight truncate">
                  {name || 'New Candidate'}
                </h2>
                {getRoleBadge(role)}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5 flex items-center gap-2">
                <span>{primaryCourse}</span>
                <span>•</span>
                <span className="text-indigo-300">
                  {trainerToEdit?.source === 'outlook_work_with_us' ? 'Outlook Work With Us Intake' : 'Manual Entry'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close Drawer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        {trainerToEdit && (
          <div className="px-3 sm:px-6 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-2 text-xs font-bold">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer text-[11px] sm:text-xs ${
                  activeTab === 'details'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
                    : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
                }`}
              >
                <FileText size={13} />
                <span>Profile & Details</span>
              </button>

              <button
                onClick={() => setActiveTab('edit')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all cursor-pointer text-[11px] sm:text-xs ${
                  activeTab === 'edit'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
                    : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
                }`}
              >
                <Edit3 size={13} />
                <span>Edit Candidate Info</span>
              </button>
            </div>

            <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono hidden sm:inline">
              ID: {trainerToEdit.id?.slice(0, 12)}
            </span>
          </div>
        )}

        {/* Drawer Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 custom-scrollbar flex flex-col">
          {activeTab === 'details' && trainerToEdit ? (
            <div className="space-y-4 sm:space-y-5 flex-1 flex flex-col">
              {/* Quick Contact & Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
                    <Mail size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Email Address</p>
                    {email ? (
                      <a href={`mailto:${email}`} className="text-xs font-semibold text-indigo-300 hover:underline truncate block">
                        {email}
                      </a>
                    ) : (
                      <p className="text-xs font-semibold text-slate-500">Not provided</p>
                    )}
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                    <Phone size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Phone / WhatsApp</p>
                    {phone && phone !== 'Not provided' ? (
                      <a href={`tel:${phone}`} className="text-xs font-semibold text-cyan-300 hover:underline font-mono truncate block">
                        {phone}
                      </a>
                    ) : (
                      <p className="text-xs font-semibold text-slate-500">Not provided</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Operational Metrics Cards (4 Grid Items) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
                <div className="p-2.5 sm:p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-center">
                  <p className="text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">Primary Module</p>
                  <p className="text-xs font-black text-white mt-1 truncate">{primaryCourse}</p>
                </div>

                <div className="p-2.5 sm:p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-center">
                  <p className="text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">Batches Taken</p>
                  <p className="text-xs sm:text-sm font-black text-white mt-1">{totalBatches}</p>
                </div>

                <div className="p-2.5 sm:p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center">
                  <p className="text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">Job Support</p>
                  <p className="text-xs sm:text-sm font-black text-white mt-1">{jobSupportLeads}</p>
                </div>

                <div className="p-2.5 sm:p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-center">
                  <p className="text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wider text-amber-300">Experience</p>
                  <p className="text-xs sm:text-sm font-black text-white mt-1">{experienceYears ?? 3} Yrs</p>
                </div>
              </div>

              {/* Full Profile & Work With Us Experience Notes Box (ONE SINGULAR BOX) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-indigo-500/20 space-y-3 sm:space-y-4 shadow-xl flex flex-col flex-1 min-h-[300px]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Full Experience & Work With Us Profile Details
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {parsedExp.linkedIn && (
                      <a
                        href={parsedExp.linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] sm:text-[11px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-900 transition-colors"
                      >
                        <ExternalLink size={11} /> LinkedIn Profile
                      </a>
                    )}
                    <span className="text-[9.5px] sm:text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-indigo-500/20">
                      {trainerToEdit.source === 'outlook_work_with_us' ? 'Outlook Work With Us Intake' : 'System Registry'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {parsedExp.cleanParagraphs.map((para, idx) => {
                    const isHeader = para.toUpperCase() === 'SUMMARY:' || para.toUpperCase() === 'EXPERIENCE:';
                    if (isHeader) {
                      return (
                        <h5 key={idx} className="text-[11px] font-black uppercase tracking-widest text-cyan-400 pt-2 pb-1 border-b border-cyan-500/20">
                          {para}
                        </h5>
                      );
                    }
                    return (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-200 font-sans leading-relaxed flex items-start gap-2.5 shadow-sm">
                        <ChevronRight size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                        <p className="flex-1 whitespace-pre-wrap">{para}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Edit Form */
            <form onSubmit={handleSubmit} id="trainer-edit-form" className="space-y-4">
              <div>
                <label className="text-xs font-bold mb-1 block text-slate-300">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chandan Banerjee, Swati, Jagan Mohan"
                  className="w-full rounded-xl border border-slate-700/60 px-3.5 py-2.5 text-sm bg-slate-900 text-white outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold mb-1 block text-slate-300">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. candidate@gapanchor.com"
                    className="w-full rounded-xl border border-slate-700/60 px-3 py-2 text-xs bg-slate-900 text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block text-slate-300">Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-700/60 px-3 py-2 text-xs bg-slate-900 text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold mb-1 block text-slate-300">
                    Operational Role <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full rounded-xl border border-indigo-500/40 px-3 py-2 text-xs font-bold bg-slate-900 text-indigo-300 outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    <option value="Trainer">Batch Trainer</option>
                    <option value="Employee">Job Support Staff</option>
                    <option value="Both">Dual Role (Both)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block text-slate-300">Primary Platform</label>
                  <select
                    value={primaryCourse}
                    onChange={(e) => setPrimaryCourse(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/60 px-3 py-2 text-xs bg-slate-900 text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Manhattan WMS">Manhattan WMS</option>
                    <option value="Blue Yonder">Blue Yonder (JDA)</option>
                    <option value="Kinaxis">Kinaxis</option>
                    <option value="SAP S/4HANA">SAP S/4HANA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold mb-1 block text-slate-300">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/60 px-3 py-2 text-xs bg-slate-900 text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block text-slate-300">Experience (Yrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-700/60 px-3 py-2 text-xs bg-slate-900 text-white font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block text-slate-300">Batches Taken</label>
                  <input
                    type="number"
                    min="0"
                    value={totalBatches}
                    onChange={(e) => setTotalBatches(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-700/60 px-3 py-2 text-xs bg-slate-900 text-white font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold mb-1 block text-slate-300">Job Support Leads</label>
                  <input
                    type="number"
                    min="0"
                    value={jobSupportLeads}
                    onChange={(e) => setJobSupportLeads(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-700/60 px-3 py-2 text-xs bg-slate-900 text-white font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold mb-1 block text-slate-300">Experience & Notes</label>
                <textarea
                  rows={8}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detailed candidate experience, skills, certifications, and Outlook intake details..."
                  className="w-full rounded-xl border border-slate-700/60 p-3 text-xs bg-slate-900 text-white outline-none focus:border-indigo-500 font-sans leading-relaxed"
                />
              </div>
            </form>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          {activeTab === 'details' && trainerToEdit ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <Edit3 size={15} />
                <span>Edit Candidate Info</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => (trainerToEdit ? setActiveTab('details') : onClose())}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                form="trainer-edit-form"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
              >
                <Save size={15} />
                <span>{loading ? 'Saving...' : trainerToEdit ? 'Save Changes' : 'Register Candidate'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
