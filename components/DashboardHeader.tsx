'use client';

import React from 'react';
import { Activity, Mail, MessageSquare, ShieldCheck, RefreshCw, Sun, Moon, Settings } from 'lucide-react';
import UserNav from '@/components/UserNav';
import { useTheme } from '@/components/ui/ThemeProvider';

import { NavMenuIcon } from '@/components/NavigationDrawer';

interface Props {
  onRefresh: () => void;
  isRefreshing: boolean;
  graphStatus: any;
  whatsappStatus: any;
  onOpenSetup: (tab: 'meta' | 'microsoft') => void;
  onOpenNav?: () => void;
}

export default function DashboardHeader({ onRefresh, isRefreshing, graphStatus, whatsappStatus, onOpenSetup, onOpenNav }: Props) {
  const { theme, toggle } = useTheme();

  return (
    <header className="glass-card !p-2.5 sm:!p-6 mb-3 sm:mb-6 rounded-2xl sm:rounded-3xl animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Brand & Nav Drawer Trigger */}
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
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap mt-0.5 sm:mt-0">
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
              ({graphStatus?.outlookEmail || 'contact@gapanchor.com'})
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

          {/* Glossy Liquid Glass Navigation Drawer Trigger Button */}
          <button
            onClick={onOpenNav}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-slate-900/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/25 dark:border-white/20 text-white hover:bg-slate-800/90 hover:border-brand-500/60 hover:shadow-[0_0_24px_rgba(99,102,241,0.4)] hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer group relative overflow-hidden shadow-lg shadow-black/20"
            title="Open Ops Navigation Drawer"
            aria-label="Open Navigation Drawer"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/25 via-white/15 to-transparent opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <NavMenuIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-100 group-hover:text-brand-300 group-hover:scale-110 transition-transform relative z-10" strokeWidth={2.8} />
          </button>
        </div>
      </div>
    </header>
  );
}
