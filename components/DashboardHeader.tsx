'use client';

import React from 'react';
import { Activity, Mail, MessageSquare, ShieldCheck, RefreshCw, Sun, Moon, Settings } from 'lucide-react';
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
    <header className="glass-card mb-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-brand-500/30">
            <Activity size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                GapAnchor Ops Dashboard
              </h1>
              <span className="bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Enterprise
              </span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Finance Intelligence • Training Ops • WhatsApp Comms • Dev Progress
            </p>
          </div>
        </div>

        {/* Status Badges & Setup Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Outlook setup trigger badge */}
          <button
            onClick={() => onOpenSetup('microsoft')}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold border transition-all hover:scale-105 ${
              graphStatus?.connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
            title="Click to configure Outlook Microsoft Graph OAuth"
          >
            <Mail size={13} />
            <span className="w-2 h-2 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
            <span>Outlook</span>
            <span className="opacity-75 text-[10px] font-mono">
              ({graphStatus?.outlookEmail || 'avpartners.consultants@outlook.com'})
            </span>
          </button>

          {/* WhatsApp setup trigger badge */}
          <button
            onClick={() => onOpenSetup('meta')}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold border transition-all hover:scale-105 ${
              whatsappStatus?.connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
            title="Click to configure Meta Business Suite WhatsApp API"
          >
            <MessageSquare size={13} />
            <span className="w-2 h-2 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
            <span>WhatsApp</span>
            <span className="opacity-75 text-[10px] font-mono">
              ({whatsappStatus?.phoneNumber || '+91 7598 505 274'})
            </span>
          </button>

          {/* Security */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <ShieldCheck size={13} />
            <span>OAuth2</span>
          </div>

          {/* API Setup button */}
          <button
            onClick={() => onOpenSetup('meta')}
            className="btn-secondary !py-2 !px-3"
            title="Open Live API Setup Center"
          >
            <Settings size={14} />
            <span className="text-xs">Setup APIs</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="btn-secondary !p-2 !rounded-full"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Refresh */}
          <button onClick={onRefresh} disabled={isRefreshing} className="btn-secondary !py-2 !px-3">
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="text-xs">{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
