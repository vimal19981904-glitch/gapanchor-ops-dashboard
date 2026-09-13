'use client';

import React from 'react';
import { Activity, Mail, MessageSquare, ShieldCheck, RefreshCw, Sun, Moon, Settings } from 'lucide-react';
import UserNav from '@/components/UserNav';
import { useTheme } from '@/components/ui/ThemeProvider';

interface Props {
  onRefresh: () => void;
  isRefreshing: boolean;
  graphStatus: any;
  whatsappStatus: any;
  onOpenSetup: (tab: 'meta' | 'microsoft') => void;
}

export default function DashboardHeader({ onRefresh, isRefreshing, graphStatus, whatsappStatus, onOpenSetup }: Props) {
  const { theme, toggle } = useTheme();

  return (
    <header className="glass-card !p-3 sm:!p-6 mb-3 sm:mb-6 rounded-2xl sm:rounded-3xl animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-brand-500/30 shrink-0">
            <Activity size={20} className="sm:w-[26px] sm:h-[26px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent truncate">
                GapAnchor Ops Dashboard
              </h1>
              <span className="bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                Enterprise
              </span>
            </div>
            <p className="text-[10px] sm:text-xs font-medium hidden sm:block truncate" style={{ color: 'var(--text-tertiary)' }}>
              Finance Intelligence • Training Ops • WhatsApp Comms • Dev Progress
            </p>
          </div>
        </div>

        {/* Status Badges & Setup Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
          {/* Outlook setup trigger badge */}
          <button
            onClick={() => onOpenSetup('microsoft')}
            className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold border transition-all hover:scale-105 ${
              graphStatus?.connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
            title="Click to configure Outlook Microsoft Graph OAuth"
          >
            <Mail size={12} className="sm:w-[13px] sm:h-[13px]" />
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
            <span>Outlook</span>
            <span className="opacity-75 text-[10px] font-mono hidden sm:inline">
              ({graphStatus?.outlookEmail || 'avpartners.consultants@outlook.com'})
            </span>
          </button>

          {/* WhatsApp setup trigger badge */}
          <button
            onClick={() => onOpenSetup('meta')}
            className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold border transition-all hover:scale-105 ${
              whatsappStatus?.connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
            title="Click to configure Meta Business Suite WhatsApp API"
          >
            <MessageSquare size={12} className="sm:w-[13px] sm:h-[13px]" />
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
            <span>WhatsApp</span>
            <span className="opacity-75 text-[10px] font-mono hidden sm:inline">
              ({whatsappStatus?.phoneNumber || '+91 7598 505 274'})
            </span>
          </button>

          {/* Security */}
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <ShieldCheck size={13} />
            <span>OAuth2</span>
          </div>

          {/* User Session & Sign Out */}
          <UserNav />

          {/* API Setup button */}
          <button
            onClick={() => onOpenSetup('meta')}
            className="btn-secondary !py-1.5 !px-2.5 sm:!py-2 sm:!px-3"
            title="Open Live API Setup Center"
          >
            <Settings size={13} className="sm:w-[14px] sm:h-[14px]" />
            <span className="text-[11px] sm:text-xs">Setup APIs</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="btn-secondary !p-1.5 sm:!p-2 !rounded-full"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={14} className="sm:w-4 sm:h-4" /> : <Moon size={14} className="sm:w-4 sm:h-4" />}
          </button>

          {/* Refresh */}
          <button onClick={onRefresh} disabled={isRefreshing} className="btn-secondary !py-1.5 !px-2.5 sm:!py-2 sm:!px-3">
            <RefreshCw size={13} className={`sm:w-[14px] sm:h-[14px] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-[11px] sm:text-xs">{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
