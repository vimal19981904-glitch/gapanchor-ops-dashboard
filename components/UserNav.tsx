'use client';

import React, { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, Shield, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface UserNavProps {
  variant?: 'header' | 'drawer';
  onOpenSetup?: (tab: 'meta' | 'microsoft') => void;
}

export default function UserNav({ variant = 'header', onOpenSetup }: UserNavProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Signed out successfully');
        window.location.href = '/login';
      } else {
        toast.error('Logout failed');
        setLoggingOut(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Logout failed');
      setLoggingOut(false);
    }
  };

  if (variant === 'drawer') {
    if (loading) {
      return (
        <div className="h-16 w-full rounded-2xl bg-slate-900/80 animate-pulse border border-white/10" />
      );
    }

    if (!user) {
      return (
        <div className="p-3 bg-slate-900/90 border border-white/15 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center">
              <UserIcon size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Guest User</div>
              <div className="text-[10px] text-slate-400">Not signed in</div>
            </div>
          </div>
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold bg-brand-500 text-white hover:bg-brand-600 transition-all no-underline shadow-md"
          >
            <UserIcon size={14} />
            <span>Sign In</span>
          </a>
        </div>
      );
    }

    const isDemo = user.email?.toLowerCase() === 'demo@gapanchor.com' || user.isDemo || user.accountType === 'demo';

    return (
      <div className="p-3 bg-slate-900/95 border border-white/15 rounded-2xl flex flex-col gap-2.5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-md ${
              isDemo ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-brand-500 to-indigo-600'
            }`}>
              {user.name && user.name.toLowerCase().includes('arul') ? 'M' : (user.name ? user.name.charAt(0).toUpperCase() : 'A')}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100 truncate">
                  {user.name && user.name.toLowerCase().includes('arul') ? 'Master Admin' : (user.name || 'Master Admin')}
                </span>
                <span className={`px-1.5 py-0.2 text-[8px] font-black rounded-full uppercase tracking-widest font-mono border ${
                  isDemo
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {isDemo ? 'DEMO' : (user.role?.toUpperCase() || 'ADMIN')}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user.email || 'contact@gapanchor.com'}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={`Sign out (${user.email})`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <LogOut size={13} className={loggingOut ? 'animate-spin' : ''} />
            <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>

        {onOpenSetup && (
          <button
            onClick={() => onOpenSetup('meta')}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-white/10 transition-all cursor-pointer"
          >
            <Settings size={14} className="text-brand-400" />
            <span>Setup APIs & Integration Credentials</span>
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-8 w-28 rounded-full bg-slate-800/80 animate-pulse border border-slate-700/50" />
    );
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold border border-brand-500/40 bg-brand-500/15 text-brand-300 hover:bg-brand-500/25 transition-all no-underline"
      >
        <UserIcon size={14} />
        <span>Sign In</span>
      </a>
    );
  }

  const isDemo = user.email?.toLowerCase() === 'demo@gapanchor.com' || user.isDemo || user.accountType === 'demo';

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 border rounded-full pl-2 pr-1.5 py-1 shadow-lg backdrop-blur-md shrink-0 ${
      isDemo
        ? 'bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-purple-500/50 ring-1 ring-purple-500/30'
        : 'bg-slate-900/90 border-slate-700/60'
    }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold shrink-0 shadow-sm ${
        isDemo ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-brand-500 to-indigo-600'
      }`}>
        {user.name && user.name.toLowerCase().includes('arul') ? 'M' : (user.name ? user.name.charAt(0).toUpperCase() : 'A')}
      </div>
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-slate-100 truncate max-w-[70px] sm:max-w-[120px]">
            {user.name && user.name.toLowerCase().includes('arul') ? 'Master Admin' : (user.name || 'Master Admin')}
          </span>
          {isDemo && (
            <span className="px-1.5 py-0.2 text-[8px] font-black rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-widest font-mono">
              DEMO
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium truncate max-w-[70px] sm:max-w-[120px] hidden sm:inline text-slate-400">
          {isDemo ? 'Isolated • 0 DB Queries' : (user.role === 'admin' ? 'Master Admin' : user.assignedCourse || user.role || 'Team Member')}
        </span>
      </div>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        title={`Sign out (${user.email})`}
        className="flex items-center gap-1 sm:gap-1.5 ml-0.5 sm:ml-1 px-2 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
      >
        <LogOut size={12} className={`sm:w-3.5 sm:h-3.5 ${loggingOut ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
      </button>
    </div>
  );
}

