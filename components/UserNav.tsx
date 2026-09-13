'use client';

import React, { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function UserNav() {
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

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 border border-slate-700/60 rounded-full pl-2 pr-1.5 py-1 shadow-lg backdrop-blur-md shrink-0">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-extrabold shrink-0 shadow-sm">
        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-bold text-slate-100 truncate max-w-[70px] sm:max-w-[120px]">
          {user.name}
        </span>
        <span className="text-[10px] text-slate-400 font-medium truncate max-w-[70px] sm:max-w-[120px] hidden sm:inline">
          {user.role === 'admin' ? 'Master Admin' : user.assignedCourse || user.role || 'Team Member'}
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
