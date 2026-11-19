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
  Layers,
  ArrowUpRight,
  Briefcase,
  BarChart3
} from 'lucide-react';
import UserNav from '@/components/UserNav';


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
  onOpenFinanceModal?: () => void;
  onOpenOpsModal?: () => void;
  onOpenEnquiryModal?: () => void;
  onOpenDevModal?: () => void;
  onOpenSetupModal?: (tab: 'meta' | 'microsoft') => void;
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
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = `/#${sectionId}`;
      return;
    }
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

  const sections = [
    {
      id: 'ops-analytics',
      title: 'Ops Peak Analytics',
      icon: BarChart3,
      action: () => handleAction(() => { window.location.href = '/ops-analytics'; }),
    },
    {
      id: 'finance',
      title: 'Finance Intelligence',
      icon: DollarSign,
      action: () => handleAction(() => { window.location.href = '/finance/analytics'; }),
    },
    {
      id: 'comms',
      title: 'Leads',
      icon: MessageSquare,
      action: () => handleAction(() => { window.location.href = '/enquiries'; }),
    },
    {
      id: 'job-support',
      title: 'Job Support Operations',
      icon: Briefcase,
      action: () => handleAction(() => { window.location.href = '/job-support'; }),
    },
    {
      id: 'ops',
      title: 'GapAnchor Training Operations',
      icon: Calendar,
      action: () => handleAction(() => { window.location.href = '/training'; }),
    },
    {
      id: 'dev',
      title: 'Dev Progress & Infra',
      icon: Code2,
      action: () => scrollToSection('dev-section'),
    },
    {
      id: 'calendar',
      title: 'GapAnchor Calendar',
      icon: Calendar,
      action: () => handleAction(() => { window.location.href = '/calendar'; }),
    },
    {
      id: 'setup',
      title: 'API & Integration Setup',
      icon: Settings,
      action: () => scrollToSection('setup-section'),
    },
  ];

  const filteredSections = sections.filter((sec) =>
    sec.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden animate-fade-only cursor-pointer"
      onClick={onClose}
    >
      {/* Darkened Backdrop for High Contrast & Text Clarity */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Drawer Panel - Solid High-Opacity Dark Glass sliding from Right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-[92vw] sm:w-[520px] md:w-[42vw] lg:w-[40vw] max-w-[850px] min-w-[360px] bg-slate-950/95 backdrop-blur-2xl border-l border-white/20 shadow-[-30px_0_90px_rgba(0,0,0,0.95)] text-slate-100 flex flex-col relative z-10 animate-drawer-slide-in cursor-default pointer-events-auto"
        >
          
          {/* Drawer Header - Solid Opaque Dark Slate */}
          <div className="p-3.5 sm:p-4 border-b border-white/15 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500/40 via-indigo-500/30 to-white/10 border border-white/20 flex items-center justify-center text-white shadow-md shrink-0">
                  <NavMenuIcon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <h2 className="text-sm font-black text-white tracking-tight">
                  Ops Navigation
                </h2>
              </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Bar - Opaque Dark Header */}
          <div className="p-3 border-b border-white/15 bg-slate-950">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search navigation..."
                className="w-full bg-slate-900 border border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white text-[10px] font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Drawer Body - High Contrast Module Links */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
            {/* User Account Profile & Actions */}
            <UserNav variant="drawer" onOpenSetup={onOpenSetupModal} />

            {filteredSections.length === 0 ? (
              <div className="text-center py-8 text-slate-300 text-xs">
                No matching navigation modules found for "{searchQuery}".
              </div>
            ) : (
              filteredSections.map((sec) => {
                const IconComp = sec.icon;

                return (
                  <div
                    key={sec.id}
                    onClick={sec.action}
                    className="group p-3 sm:py-3.5 sm:px-4 rounded-xl border border-white/20 bg-slate-900/95 transition-all duration-200 hover:border-cyan-500/70 hover:bg-slate-800 shadow-lg hover:shadow-cyan-500/15 cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <IconComp
                        size={18}
                        className="text-cyan-400 group-hover:text-cyan-300 transition-colors shrink-0"
                      />
                      <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 transition-colors truncate">
                        {sec.title}
                      </h3>
                    </div>

                    <ArrowUpRight
                      size={16}
                      className="text-slate-400 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0"
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer - Solid Opaque Dark Slate (Desktop Only) */}
          <div className="hidden sm:flex p-3.5 border-t border-white/15 bg-slate-950 items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-300 font-semibold">
              <Layers size={13} className="text-brand-400" />
              <span>GapAnchor Ops Suite</span>
            </div>
            <button
              onClick={() => handleAction(() => { window.location.href = '/finance/analytics'; })}
              className="text-[11px] font-bold text-brand-400 hover:text-brand-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
            >
              <span>Quick Ledger</span>
              <ArrowUpRight size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
