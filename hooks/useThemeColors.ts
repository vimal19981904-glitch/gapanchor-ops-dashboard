'use client';

import { useTheme } from '@/components/ui/ThemeProvider';

export interface ThemeChartColors {
  isDark: boolean;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  textColor: string;
  subtextColor: string;
  series: string[];
  primaryStroke: string;
  secondaryStroke: string;
  areaFillGradient: {
    start: string;
    startOpacity: number;
    mid: string;
    midOpacity: number;
    end: string;
    endOpacity: number;
  };
}

export function useThemeColors(): ThemeChartColors {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (!isDark) {
    return {
      isDark: false,
      grid: '#f1f5f9',
      tooltipBg: '#ffffff',
      tooltipBorder: '#e2e8f0',
      tooltipText: '#0f172a',
      textColor: '#475569',
      subtextColor: '#94a3b8',
      series: ['#2563eb', '#059669', '#d97706', '#7c3aed', '#64748b', '#0284c7', '#4f46e5'],
      primaryStroke: '#2563eb',
      secondaryStroke: '#059669',
      areaFillGradient: {
        start: '#2563eb',
        startOpacity: 0.25,
        mid: '#2563eb',
        midOpacity: 0.08,
        end: '#2563eb',
        endOpacity: 0.0,
      },
    };
  }

  // Dark Mode (Pixel-Identical Current Baseline)
  return {
    isDark: true,
    grid: 'rgba(255, 255, 255, 0.06)',
    tooltipBg: '#090d16',
    tooltipBorder: 'rgba(255, 255, 255, 0.15)',
    tooltipText: '#ffffff',
    textColor: '#94a3b8',
    subtextColor: '#64748b',
    series: ['#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#52525b'],
    primaryStroke: '#ffffff',
    secondaryStroke: '#64748b',
    areaFillGradient: {
      start: '#f8fafc',
      startOpacity: 0.38,
      mid: '#64748b',
      midOpacity: 0.14,
      end: '#0f172a',
      endOpacity: 0.02,
    },
  };
}
