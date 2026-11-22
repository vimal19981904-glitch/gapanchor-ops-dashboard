'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Globe,
  FileText,
  Eye,
  MessageSquare,
  Mail,
  UserCheck,
  Phone,
} from 'lucide-react';

import DeleteRecordAction from './DeleteRecordAction';
import { LeadTeamsIndicators } from './call-intelligence/LeadTeamsIndicators';

export interface MobileLeadItem {
  id: string;
  participantName: string;
  email: string | null;
  phone: string;
  country: string | null;
  serviceType: string | null;
  trainingType: string | null;
  topic: string;
  lastMessage: string | null;
  messageTimestamp: string;
  dateSubmitted: string | null;
  receivedDate: string | null;
  leadQuality: string; // Unrated, High, Medium, Low
  contactStatus: string; // Pending, In Touch, Talked, Converted, Lost
  status: string; // Open, Action Required, Processed, Resolved
  source: string;
  processedNotes: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
}

interface MobileLeadCardsProps {
  leads: MobileLeadItem[];
  expandedLeadId: string | null;
  onToggleExpand: (id: string) => void;
  onUpdateStatus?: (id: string, updates: Partial<MobileLeadItem>) => void;
  onAddNotes?: (lead: MobileLeadItem) => void;
  onViewDetail?: (lead: MobileLeadItem) => void;
  onAssign?: (lead: MobileLeadItem) => void;
  onDeleteRecord?: (id: string) => void;
  isAdmin?: boolean;
}

// Exactly matching desktop status colors and badges
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'Pending': { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  'In Touch': { label: 'In Touch', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  'Talked': { label: 'Talked', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  'Future': { label: 'Future', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  'Converted': { label: 'Converted', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  'Lost': { label: 'Lost', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

const QUALITY_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'High': { label: 'High Quality', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  'Medium': { label: 'Medium Quality', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  'Low': { label: 'Low Quality', color: 'text-slate-400', bg: 'bg-slate-800/60', border: 'border-slate-700' },
  'Unrated': { label: 'Unrated', color: 'text-slate-500', bg: 'bg-slate-900/50', border: 'border-slate-800' },
};

export default function MobileLeadCards({
  leads,
  expandedLeadId,
  onToggleExpand,
  onUpdateStatus,
  onAddNotes,
  onViewDetail,
  onAssign,
  isAdmin = false,
}: MobileLeadCardsProps) {
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const cleanPhone = (phoneStr: string) => phoneStr.replace(/[^0-9+]/g, '');

  return (
    <div className="mobile-leads-container md:hidden w-full space-y-2 px-1">
      {leads.map((lead) => {
        const isExpanded = expandedLeadId === lead.id;
        const statusConfig = STATUS_MAP[lead.contactStatus] || STATUS_MAP['Pending'];
        const qualityConfig = QUALITY_MAP[lead.leadQuality] || QUALITY_MAP['Unrated'];
        const courseText = lead.trainingType || lead.topic || 'Training';
        const countryText = lead.country || 'India';
        const formattedDate = formatDate(lead.dateSubmitted || lead.receivedDate || lead.messageTimestamp);
        const initials = lead.participantName ? lead.participantName.trim().charAt(0).toUpperCase() : '?';

        return (
          <div
            key={`mobile-lead-${lead.id}`}
            className={`rounded-xl border transition-all ${
              isExpanded
                ? 'bg-slate-900/95 border-slate-700/80 shadow-lg'
                : 'bg-slate-900/70 hover:bg-slate-800/60 border-slate-800/80'
            }`}
          >
            {/* ── Sleek Uniform 2-Line Header (Clean, Compact & Consistent) ── */}
            <div
              className="px-3 py-2.5 cursor-pointer select-none"
              onClick={() => onToggleExpand(lead.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleExpand(lead.id);
                }
              }}
              aria-expanded={isExpanded}
            >
              {/* Line 1: Avatar + Fixed-Width Name (Straight Column Alignment) + Teams & To-Do | Call Button + Boxy Status + Chevron */}
              <div className="flex items-center justify-between gap-1.5 w-full">
                {/* Left group: Avatar + Name + Indicators */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Compact Avatar */}
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-600/20 to-indigo-600/20 border border-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {initials}
                  </div>

                  {/* Fixed-Width Name Column (Guarantees Teams & To-Do icons stay in a 100% straight vertical line across all cards) */}
                  <div className="w-[100px] xs:w-[122px] shrink-0 overflow-hidden">
                    <span
                      className="font-bold text-white text-xs truncate block"
                      title={lead.participantName}
                    >
                      {lead.participantName}
                    </span>
                  </div>

                  {/* Teams & To-Do Indicators in fixed vertical alignment */}
                  <div
                    className="shrink-0 flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LeadTeamsIndicators
                      enquiryId={lead.id}
                      size="sm"
                      onOpenDrawer={() => {
                        if (onViewDetail) onViewDetail(lead);
                      }}
                    />
                  </div>
                </div>

                {/* Right group: Call button + Boxy Status Badge + Chevron */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {lead.phone && (
                    <a
                      href={`tel:${cleanPhone(lead.phone)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 px-2 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 no-underline shadow-sm"
                      title={`Call ${lead.participantName}`}
                    >
                      <Phone size={11} className="shrink-0" />
                      <span className="hidden min-[360px]:inline">Call</span>
                    </a>
                  )}

                  {/* Boxy Status Badge (matches Manhattan WMS boxy style) */}
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 text-center min-w-[56px] ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}
                  >
                    {statusConfig.label}
                  </span>

                  {/* Chevron Toggle */}
                  <div className="w-5 h-5 rounded text-slate-400 hover:text-cyan-400 flex items-center justify-center shrink-0 transition-colors">
                    {isExpanded ? <ChevronUp size={14} className="text-cyan-400" /> : <ChevronDown size={14} />}
                  </div>
                </div>
              </div>

              {/* Line 2: Clean Typography without outline boxes (Matches Reference Image 1) */}
              <div className="flex items-center gap-2 mt-1 pl-[36px] text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                  <Globe size={11} className="text-cyan-400 shrink-0" />
                  <span>{countryText}</span>
                </span>
                <span className="text-slate-600 font-light select-none">|</span>
                {(lead.serviceType || '').toLowerCase() === 'job support' && (
                  <>
                    <span className="text-purple-300 font-medium text-[10px]">Job Support</span>
                    <span className="text-slate-600 font-light select-none">|</span>
                  </>
                )}
                <span className="text-slate-400 font-medium truncate max-w-[190px]" title={courseText}>
                  {courseText}
                </span>
              </div>
            </div>

            {/* ── Expanded Dropdown View ── */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 space-y-2.5 animate-fade-in">
                {/* Contact Bar: Phone & Email moved into Dropdown per User Instruction */}
                <div className="grid grid-cols-1 gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/70">
                  {/* Phone */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Phone size={11} className="text-cyan-400" /> Phone Number
                    </span>
                    {lead.phone ? (
                      <a
                        href={`https://wa.me/${cleanPhone(lead.phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs font-semibold text-cyan-300 hover:text-cyan-200 hover:underline truncate"
                      >
                        <Phone size={12} className="inline shrink-0" /> {lead.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">None</span>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex items-center justify-between gap-2 min-w-0 pt-1.5 border-t border-slate-800/50">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Mail size={11} className="text-cyan-400" /> Email Address
                    </span>
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-slate-300 hover:text-cyan-300 hover:underline truncate max-w-[200px]"
                        title={lead.email}
                      >
                        <Mail size={12} className="inline shrink-0" /> {lead.email}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">None</span>
                    )}
                  </div>
                </div>

                {/* Grid 1: ID + Date Submitted + Assigned */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Lead ID</span>
                    <span className="text-xs font-mono text-slate-200 truncate block mt-0.5" title={lead.id}>
                      #{lead.id.length > 8 ? lead.id.substring(0, 6) + '…' : lead.id}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Date</span>
                    <span className="text-xs text-slate-200 truncate block mt-0.5">
                      {formattedDate}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Assigned</span>
                    <span className="text-xs text-slate-300 font-semibold truncate block mt-0.5" title={lead.assignedToName || 'Unassigned'}>
                      {lead.assignedToName ? lead.assignedToName.replace(/\s*\(.*?\)/, '') : 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Grid 2: Status & Quality Dropdowns (Desktop style) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Contact Status</span>
                    {onUpdateStatus ? (
                      <select
                        value={lead.contactStatus || 'Pending'}
                        onChange={(e) => onUpdateStatus(lead.id, { contactStatus: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs font-semibold py-1 px-2 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700/80 focus:border-cyan-400 focus:outline-none cursor-pointer"
                      >
                        {Object.keys(STATUS_MAP).map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                        {statusConfig.label}
                      </span>
                    )}
                  </div>

                  <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/50">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Lead Quality</span>
                    {onUpdateStatus ? (
                      <select
                        value={lead.leadQuality || 'Unrated'}
                        onChange={(e) => onUpdateStatus(lead.id, { leadQuality: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs font-semibold py-1 px-2 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700/80 focus:border-cyan-400 focus:outline-none cursor-pointer"
                      >
                        {Object.keys(QUALITY_MAP).map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${qualityConfig.bg} ${qualityConfig.color} ${qualityConfig.border}`}>
                        {qualityConfig.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Call Notes (if any) */}
                {lead.processedNotes && (
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs text-slate-300 italic truncate">
                    💬 {lead.processedNotes}
                  </div>
                )}

                {/* Action Buttons: Left: Notes | Center: Call, WhatsApp, Assign | Right Corner: View Detail */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {/* Left: Notes Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onAddNotes) onAddNotes(lead);
                    }}
                    className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <FileText size={13} className="text-slate-400" />
                    <span>Notes</span>
                  </button>

                  {/* Center: Call, WhatsApp / Message, Assign Lead */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-center">
                    {/* Direct Mobile Call */}
                    {lead.phone && (
                      <a
                        href={`tel:${cleanPhone(lead.phone)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors no-underline flex items-center justify-center shadow-sm"
                        title={`Call ${lead.participantName}`}
                      >
                        <Phone size={14} />
                      </a>
                    )}

                    {/* WhatsApp / Message */}
                    {lead.phone ? (
                      <a
                        href={`https://wa.me/${cleanPhone(lead.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors no-underline flex items-center justify-center shadow-sm"
                        title="WhatsApp Message"
                      >
                        <MessageSquare size={14} />
                      </a>
                    ) : lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400 transition-colors no-underline flex items-center justify-center shadow-sm"
                        title="Email Contact"
                      >
                        <Mail size={14} />
                      </a>
                    ) : null}

                    {/* Assign Button */}
                    {onAssign && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssign(lead);
                        }}
                        className="p-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                        title={lead.assignedToName ? `Currently assigned to ${lead.assignedToName}. Click to reassign.` : "Assign Lead"}
                      >
                        <UserCheck size={14} />
                      </button>
                    )}
                  </div>

                  {/* Right corner: View Detail Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onViewDetail) onViewDetail(lead);
                    }}
                    className="py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Eye size={13} className="text-slate-400" />
                    <span>View Detail</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
