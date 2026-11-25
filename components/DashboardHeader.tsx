'use client';

import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useNavigation } from '@/components/NavigationContext';
import { NavMenuIcon } from '@/components/NavigationDrawer';

interface Props {
  onRefresh: () => void;
  isRefreshing: boolean;
  graphStatus?: any;
  whatsappStatus?: any;
  onOpenSetup?: (tab: 'meta' | 'microsoft') => void;
  onOpenNav?: () => void;
}

export default function DashboardHeader({ onRefresh, isRefreshing, onOpenNav }: Props) {
  const { openNav } = useNavigation();
  const handleOpenNav = onOpenNav || openNav;

  return (
    <header className="glass-card !p-3 sm:!p-5 mb-3 sm:mb-6 rounded-2xl sm:rounded-3xl animate-fade-in">
      <div className="flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 shrink-0">
            <Activity size={18} className="sm:w-[24px] sm:h-[24px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
              <h1 className="text-sm sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-slate-300 dark:bg-clip-text dark:text-transparent leading-snug">
                GapAnchor Ops Dashboard
              </h1>
              <span className="bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/30 text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                Enterprise
              </span>
            </div>
            <p className="text-[10px] sm:text-xs font-medium hidden sm:block truncate text-slate-500 dark:text-slate-400 mt-0.5">
              Finance Intelligence • Training Ops • WhatsApp Comms • Dev Progress
            </p>
          </div>
        </div>

        {/* Right Action Controls: Refresh & Navigation Drawer Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn-secondary !py-1.5 !px-2.5 sm:!py-2 sm:!px-3 flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Sync & Refresh Dashboard Data"
          >
            <RefreshCw size={14} className={`sm:w-4 sm:h-4 text-brand-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-[11px] sm:text-xs font-semibold hidden xs:inline sm:inline">
              {isRefreshing ? 'Syncing...' : 'Refresh'}
            </span>
          </button>

          {/* Liquid Glass Navigation Drawer Trigger Button */}
          <button
            onClick={handleOpenNav}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-full bg-white/90 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-white/20 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-blue-500/60 dark:hover:border-brand-500/60 hover:shadow-md dark:hover:shadow-[0_0_24px_rgba(99,102,241,0.4)] active:scale-95 transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer group relative overflow-hidden shadow-sm dark:shadow-lg dark:shadow-black/20"
            title="Open Ops Navigation Drawer"
            aria-label="Open Navigation Drawer"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 dark:from-brand-500/25 via-transparent dark:via-white/15 to-transparent opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <NavMenuIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-brand-300 transition-transform relative z-10" strokeWidth={2.8} />
          </button>
        </div>
      </div>
    </header>
  );
}

