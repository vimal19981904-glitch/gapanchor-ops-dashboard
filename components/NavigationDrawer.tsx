'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  DollarSign,
  MessageSquare,
  Calendar,
  Code2,
  Settings,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function NavMenuIcon({ className = "w-5 h-5", strokeWidth = 2.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Top line - longer */}
      <line x1="4" y1="8.5" x2="20" y2="8.5" />
      {/* Bottom line - shorter */}
      <line x1="4" y1="15.5" x2="14" y2="15.5" />
    </svg>
  );
}

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFinanceModal: () => void;
  onOpenOpsModal: () => void;
  onOpenEnquiryModal: () => void;
  onOpenDevModal: () => void;
  onOpenSetupModal: (tab: 'meta' | 'microsoft') => void;
  financeSummary?: any;
  opsSummary?: any;
  commsSummary?: any;
  devSummary?: any;
}

export default function NavigationDrawer({
  isOpen,
  onClose,
  onOpenFinanceModal,
  onOpenOpsModal,
  onOpenEnquiryModal,
  onOpenDevModal,
  onOpenSetupModal,
  financeSummary,
  opsSummary,
  commsSummary,
  devSummary,
}: NavigationDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('finance');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent scroll when drawer open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const scrollToSection = (sectionId: string) => {
    onClose();
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-brand-500', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-brand-500', 'ring-offset-2');
        }, 2000);
      }
    }, 150);
  };

  const handleAction = (action: () => void) => {
    onClose();
    setTimeout(() => {
      action();
    }, 150);
  };

  const totalIncome = financeSummary?.totalIncome || 0;
  const netProfit = financeSummary?.netProfit || 0;
  const totalSessions = opsSummary?.totalSessions || 0;
  const totalParticipants = opsSummary?.totalParticipants || 0;
  const enquiryTotal = commsSummary?.total || 0;
  const actionCount = commsSummary?.actionRequiredCount || 0;
  const devCount = devSummary?.updates?.length || 0;

  const sections = [
    {
      id: 'finance',
      title: 'Finance Intelligence',
      subtitle: 'Transactions, Income, Expenses & Ledgers',
      icon: DollarSign,
      color: 'emerald',
      badge: netProfit > 0 ? formatCurrency(netProfit) : 'Active Ledger',
      targetId: 'finance-section',
      subComponents: [
        {
          name: 'Finance Expanded View',
          description: 'Open full transaction ledger & entry modal',
          icon: Sparkles,
          isExpandedView: true,
          action: () => handleAction(onOpenFinanceModal),
        },
        {
          name: 'Revenue & Expense Breakdown',
          description: 'Scroll to financial analytics charts',
          icon: ArrowUpRight,
          isExpandedView: false,
          action: () => scrollToSection('finance-section'),
        },
      ],
    },
    {
      id: 'comms',
      title: 'Leads & WhatsApp Comms',
      subtitle: 'Lead Pipeline, Enquiries & Outlook Sync',
      icon: MessageSquare,
      color: 'cyan',
      badge: actionCount > 0 ? `${actionCount} Action Required` : `${enquiryTotal} Total Leads`,
      targetId: 'comms-section',
      subComponents: [
        {
          name: 'Leads & Enquiries Expanded View',
          description: 'Manage, assign, and upload leads',
          icon: Sparkles,
          isExpandedView: true,
          action: () => handleAction(onOpenEnquiryModal),
        },
        {
          name: 'WhatsApp & Email Command Center',
          description: 'Scroll to lead pipeline & message logs',
          icon: ArrowUpRight,
          isExpandedView: false,
          action: () => scrollToSection('comms-section'),
        },
      ],
    },
    {
      id: 'ops',
      title: 'Training Operations',
      subtitle: 'SCM Batches, Manhattan/BY Training & Rosters',
      icon: Calendar,
      color: 'indigo',
      badge: `${totalSessions} Sessions • ${totalParticipants} Trainees`,
      targetId: 'ops-section',
      subComponents: [
        {
          name: 'Add / Manage Sessions Expanded View',
          description: 'Open training session modal & participant editor',
          icon: Sparkles,
          isExpandedView: true,
          action: () => handleAction(onOpenOpsModal),
        },
        {
          name: 'Training Batches Roster',
          description: 'Scroll to active training sessions list',
          icon: ArrowUpRight,
          isExpandedView: false,
          action: () => scrollToSection('ops-section'),
        },
      ],
    },
    {
      id: 'dev',
      title: 'Dev Progress & Infra',
      subtitle: 'Shipped Features, Fixes & Roadmap',
      icon: Code2,
      color: 'amber',
      badge: `${devCount} Updates Shipped`,
      targetId: 'dev-section',
      subComponents: [
        {
          name: 'Dev Progress Expanded View',
          description: 'Open changelog & post release update',
          icon: Sparkles,
          isExpandedView: true,
          action: () => handleAction(onOpenDevModal),
        },
        {
          name: 'Architecture & System Status',
          description: 'Scroll to dev progress timeline',
          icon: ArrowUpRight,
          isExpandedView: false,
          action: () => scrollToSection('dev-section'),
        },
      ],
    },
    {
      id: 'calendar',
      title: 'Google Calendar Events',
      subtitle: 'Upcoming Ops Schedules & OAuth Sync',
      icon: Calendar,
      color: 'purple',
      badge: 'Live Schedules',
      targetId: 'calendar-section',
      subComponents: [
        {
          name: 'Calendar Widget & Events',
          description: 'Scroll to upcoming training calendar',
          icon: ArrowUpRight,
          isExpandedView: false,
          action: () => scrollToSection('calendar-section'),
        },
      ],
    },
    {
      id: 'setup',
      title: 'API & Integration Setup',
      subtitle: 'WhatsApp Meta API & Outlook OAuth Config',
      icon: Settings,
      color: 'blue',
      badge: 'Live Config',
      targetId: 'setup-section',
      subComponents: [
        {
          name: 'Meta WhatsApp API Setup',
          description: 'Configure phone number, tokens & webhooks',
          icon: ShieldCheck,
          isExpandedView: true,
          action: () => handleAction(() => onOpenSetupModal('meta')),
        },
        {
          name: 'Microsoft Outlook Graph OAuth',
          description: 'Configure Azure app ID & tenant authorization',
          icon: CheckCircle2,
          isExpandedView: true,
          action: () => handleAction(() => onOpenSetupModal('microsoft')),
        },
      ],
    },
  ];

  const filteredSections = sections.filter(
    (sec) =>
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.subComponents.some(
        (sub) =>
          sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sub.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Clear Backdrop without blur so background webpage content remains crisp & visible */}
      <div
        className="fixed inset-0 bg-black/30 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel - Liquid Glass sliding from Right (~40% screen width) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-[92vw] sm:w-[520px] md:w-[42vw] lg:w-[40vw] max-w-[850px] min-w-[340px] bg-slate-950/70 backdrop-blur-2xl border-l border-white/20 shadow-[-15px_0_50px_rgba(0,0,0,0.6)] text-slate-100 flex flex-col relative z-10 animate-slide-in-right">
          
          {/* Drawer Header - Liquid Glass Header */}
          <div className="p-5 border-b border-white/10 bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500/30 via-indigo-500/20 to-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-lg shrink-0">
                <NavMenuIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  Ops Navigation
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    Drawer
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">Quick jump & expanded views</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close navigation"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-white/10 bg-slate-900/30 backdrop-blur-md">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter dashboard components..."
                className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Drawer Body - Scrollable Sections & Sub-Components */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredSections.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No matching navigation modules found for "{searchQuery}".
              </div>
            ) : (
              filteredSections.map((sec) => {
                const IconComp = sec.icon;
                const isExpanded = expandedSection === sec.id || searchQuery.length > 0;

                return (
                  <div
                    key={sec.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-md overflow-hidden transition-all duration-200 hover:border-brand-500/40 hover:bg-slate-900/50 shadow-sm hover:shadow-brand-500/10"
                  >
                    {/* Main Module Header */}
                    <div
                      onClick={() => setExpandedSection(isExpanded && searchQuery.length === 0 ? null : sec.id)}
                      className="p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                            sec.color === 'emerald'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : sec.color === 'cyan'
                              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                              : sec.color === 'indigo'
                              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                              : sec.color === 'amber'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : sec.color === 'purple'
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          <IconComp size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-100">{sec.title}</h3>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">{sec.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {sec.badge && (
                          <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-300 border border-white/10 font-mono">
                            {sec.badge}
                          </span>
                        )}
                        <ChevronRight
                          size={16}
                          className={`text-slate-400 transition-transform duration-200 ${
                            isExpanded ? 'rotate-90 text-brand-400' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Sub-Components Accordion Body */}
                    {isExpanded && (
                      <div className="p-2.5 pt-0 border-t border-white/10 bg-slate-950/30 space-y-1.5">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-2 py-1">
                          Sub-Components & Expanded Views
                        </div>
                        {sec.subComponents.map((sub, idx) => {
                          const SubIcon = sub.icon;
                          return (
                            <div
                              key={idx}
                              onClick={sub.action}
                              className="group p-2.5 rounded-xl border border-white/10 bg-slate-950/50 hover:bg-brand-500/15 hover:border-brand-500/40 transition-all cursor-pointer flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`p-1.5 rounded-lg ${sub.isExpandedView ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'bg-slate-800/80 text-slate-400 border border-white/5'}`}>
                                  <SubIcon size={14} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-200 group-hover:text-brand-300 transition-colors">
                                      {sub.name}
                                    </span>
                                    {sub.isExpandedView && (
                                      <span className="px-1.5 py-0.2 text-[8px] font-black rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                                        Expanded
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium">{sub.description}</p>
                                </div>
                              </div>
                              <ExternalLink size={13} className="text-slate-500 group-hover:text-brand-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-950/50 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Layers size={14} className="text-brand-400" />
              <span>GapAnchor Ops Suite v1.0</span>
            </div>
            <button
              onClick={() => handleAction(onOpenFinanceModal)}
              className="text-xs font-bold text-brand-400 hover:text-brand-300 underline underline-offset-2 flex items-center gap-1"
            >
              <span>Quick Ledger</span>
              <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
