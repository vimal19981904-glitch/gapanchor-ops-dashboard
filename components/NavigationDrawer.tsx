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
  BarChart3,
  Lock,
} from 'lucide-react';
import UserNav from '@/components/UserNav';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { toast } from 'sonner';

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

interface CurrentUserSession {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  allowedUIs?: string[];
  isActive?: boolean;
  isDemo?: boolean;
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
  const [currentUser, setCurrentUser] = useState<CurrentUserSession | null>(null);

  // Synchronise latest user permissions whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/me')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
          }
        })
        .catch(() => { });
    }
  }, [isOpen]);

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

  // Determine if a module is locked for the current user session
  const checkIsLocked = (moduleId: string): boolean => {
    if (!currentUser) return false;
    // Master Admin has unrestricted access to everything
    if (currentUser.role === 'admin' || currentUser.email?.toLowerCase() === 'admin@gapanchor.com') {
      return false;
    }
    // Demo account has unrestricted UI showcase access
    if (currentUser.role === 'DEMO' || currentUser.isDemo) {
      return false;
    }
    // Employee check based on allowedUIs array
    if (currentUser.role === 'employee') {
      const allowed = Array.isArray(currentUser.allowedUIs) ? currentUser.allowedUIs : ['enquiries'];
      if (allowed.includes('*')) {
        return false;
      }
      return !allowed.includes(moduleId);
    }
    return false;
  };

  const sections = [
    {
      id: 'ops-analytics',
      moduleId: 'ops',
      title: 'Ops Peak Analytics',
      icon: BarChart3,
      action: () => handleAction(() => { window.location.href = '/ops-analytics'; }),
    },
    {
      id: 'finance',
      moduleId: 'finance',
      title: 'Finance Intelligence',
      icon: DollarSign,
      action: () => handleAction(() => { window.location.href = '/finance/analytics'; }),
    },
    {
      id: 'comms',
      moduleId: 'enquiries',
      title: 'Leads',
      icon: MessageSquare,
      action: () => handleAction(() => { window.location.href = '/enquiries'; }),
    },
    {
      id: 'job-support',
      moduleId: 'job-support',
      title: 'Job Support Operations',
      icon: Briefcase,
      action: () => handleAction(() => { window.location.href = '/job-support'; }),
    },
    {
      id: 'ops',
      moduleId: 'training',
      title: 'GapAnchor Training Operations',
      icon: Calendar,
      action: () => handleAction(() => { window.location.href = '/training'; }),
    },
    {
      id: 'dev',
      moduleId: 'dev',
      title: 'Dev Progress & Infra',
      icon: Code2,
      action: () => scrollToSection('dev-section'),
    },
    {
      id: 'calendar',
      moduleId: 'calendar',
      title: 'GapAnchor Calendar',
      icon: Calendar,
      action: () => handleAction(() => { window.location.href = '/calendar'; }),
    },
    {
      id: 'setup',
      moduleId: 'setup',
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
      {/* Soft Light Overlay in Light Mode / Deep Dark in Dark Mode */}
      <div
        className="fixed inset-0 bg-slate-900/25 dark:bg-black/65 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Drawer Panel - Solid Clean Light Glass sliding from Right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-[92vw] sm:w-[520px] md:w-[42vw] lg:w-[40vw] max-w-[850px] min-w-[360px] bg-white dark:bg-slate-950/95 backdrop-blur-2xl border-l border-slate-200 dark:border-white/20 shadow-[-10px_0_40px_rgba(0,0,0,0.10)] dark:shadow-[-30px_0_90px_rgba(0,0,0,0.95)] text-slate-800 dark:text-slate-100 flex flex-col relative z-10 animate-drawer-slide-in cursor-default pointer-events-auto"
        >
          {/* Drawer Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 dark:from-brand-500/40 via-indigo-500/20 dark:via-indigo-500/30 to-blue-600/10 dark:to-white/10 border border-slate-200 dark:border-white/20 flex items-center justify-center text-blue-600 dark:text-white shadow-sm shrink-0">
                <NavMenuIcon className="w-4 h-4 text-blue-600 dark:text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">
                Ops Navigation
              </h2>
            </div>
            <div id="ops-nav-header-actions" className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
              <ThemeToggle compact={false} />
              <div id="ops-bell-portal-mount" className="flex items-center shrink-0" />
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search navigation..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 dark:focus:border-brand-500 focus:ring-1 focus:ring-blue-500 dark:focus:ring-brand-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white text-[10px] font-bold"
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
              <div className="text-center py-8 text-slate-400 dark:text-slate-300 text-xs">
                No matching navigation modules found for "{searchQuery}".
              </div>
            ) : (
              filteredSections.map((sec) => {
                const IconComp = sec.icon;
                const isLocked = checkIsLocked(sec.moduleId);

                return (
                  <div
                    key={sec.id}
                    onClick={() => {
                      if (isLocked) {
                        toast.error(
                          "You don't currently have access to this module. Please contact your administrator.",
                          {
                            id: `locked-${sec.id}`,
                            duration: 4000,
                          }
                        );
                        return;
                      }
                      sec.action();
                    }}
                    className={`group p-3 sm:py-3.5 sm:px-4 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${isLocked
                      ? 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-900/60 opacity-65 hover:opacity-85 hover:border-slate-300 dark:hover:border-white/20 cursor-not-allowed'
                      : 'border-slate-200 dark:border-white/20 bg-white dark:bg-slate-900/95 transition-all duration-200 hover:border-blue-500/70 dark:hover:border-cyan-500/70 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm dark:shadow-lg dark:hover:shadow-cyan-500/15 cursor-pointer'
                      }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <IconComp
                        size={18}
                        className={`${isLocked
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-blue-600 dark:text-cyan-400 group-hover:text-blue-500 dark:group-hover:text-cyan-300'
                          } transition-colors shrink-0`}
                      />
                      <h3
                        className={`text-xs sm:text-sm font-bold truncate transition-colors ${isLocked
                          ? 'text-slate-400 dark:text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'
                          : 'text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-200'
                          }`}
                      >
                        {sec.title}
                      </h3>
                    </div>

                    {isLocked ? (
                      <div
                        className="flex items-center gap-1.5 text-slate-400"
                        title="Restricted module"
                      >
                        <Lock size={15} className="text-slate-400 shrink-0" />
                      </div>
                    ) : (
                      <ArrowUpRight
                        size={16}
                        className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer - Desktop Only */}
          <div className="hidden sm:flex p-3.5 border-t border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-300 font-semibold">
              <Layers size={13} className="text-blue-600 dark:text-brand-400" />
              <span>GapAnchor Ops Suite</span>
            </div>
            <button
              onClick={() => handleAction(() => { window.location.href = '/finance/analytics'; })}
              className="text-[11px] font-bold text-blue-600 dark:text-brand-400 hover:text-blue-700 dark:hover:text-brand-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
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
