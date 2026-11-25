'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';

interface ThemeContextType {
  theme?: string;
  resolvedTheme?: string;
  systemTheme?: 'dark' | 'light';
  setTheme: (theme: string) => void;
  toggle: () => void;
  isLightModeEnabled: boolean;
}

const CustomThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggle: () => {},
  isLightModeEnabled: true,
});

function ThemeSyncBridge({ children }: { children: React.ReactNode }) {
  const { theme, resolvedTheme, systemTheme, setTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);
  const isLightModeEnabled = process.env.NEXT_PUBLIC_ENABLE_LIGHT_MODE === 'true';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && resolvedTheme) {
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    }
  }, [mounted, resolvedTheme]);

  const toggle = () => {
    if (!isLightModeEnabled) return;
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const contextValue: ThemeContextType = {
    theme: mounted ? theme : 'dark',
    resolvedTheme: mounted ? (resolvedTheme || 'dark') : 'dark',
    systemTheme: systemTheme as 'dark' | 'light' | undefined,
    setTheme: (newTheme: string) => {
      if (!isLightModeEnabled && newTheme !== 'dark') return;
      setTheme(newTheme);
    },
    toggle,
    isLightModeEnabled,
  };

  return (
    <CustomThemeContext.Provider value={contextValue}>
      {children}
    </CustomThemeContext.Provider>
  );
}

export const useTheme = () => useContext(CustomThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isLightModeEnabled = process.env.NEXT_PUBLIC_ENABLE_LIGHT_MODE === 'true';

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      storageKey="gapanchor-theme"
      disableTransitionOnChange
      forcedTheme={!isLightModeEnabled ? 'dark' : undefined}
    >
      <ThemeSyncBridge>{children}</ThemeSyncBridge>
    </NextThemesProvider>
  );
}
