'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '@/components/ui/ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export default function ThemeToggle({ className = '', compact = false }: ThemeToggleProps) {
  const { theme, setTheme, isLightModeEnabled } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isLightModeEnabled) {
    return null;
  }

  if (!mounted) {
    return (
      <div
        className={`h-8 w-[140px] rounded-lg bg-slate-900/60 dark:bg-slate-900/80 border border-white/10 animate-pulse ${className}`}
      />
    );
  }

  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Laptop },
  ];

  return (
    <div
      role="group"
      aria-label="Theme selector"
      className={`inline-flex items-center p-0.5 rounded-lg border bg-slate-900/80 dark:bg-slate-900/90 border-slate-700/60 dark:border-white/15 backdrop-blur-md shadow-sm ${className}`}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-[11px] font-bold rounded-md transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-blue-600 dark:bg-slate-800 text-white shadow-sm dark:text-cyan-300 dark:border dark:border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/5'
            }`}
            title={`Switch to ${opt.label} mode`}
            aria-pressed={isActive}
          >
            <Icon size={13} className={isActive ? 'text-white dark:text-cyan-300' : 'text-slate-400'} />
            {!compact && <span className="hidden xs:inline">{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
