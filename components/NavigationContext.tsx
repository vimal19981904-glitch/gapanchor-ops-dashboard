'use client';

import React, { createContext, useContext, useState } from 'react';
import NavigationDrawer, { NavMenuIcon } from '@/components/NavigationDrawer';

import PageTransition from '@/components/PageTransition';

interface NavigationContextType {
  isOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isOpen: false,
  openNav: () => {},
  closeNav: () => {},
  toggleNav: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openNav = () => setIsOpen(true);
  const closeNav = () => setIsOpen(false);
  const toggleNav = () => setIsOpen((prev) => !prev);

  return (
    <NavigationContext.Provider value={{ isOpen, openNav, closeNav, toggleNav }}>
      <PageTransition>{children}</PageTransition>
      <NavigationDrawer isOpen={isOpen} onClose={closeNav} />
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}

export function NavDrawerButton({ className = "" }: { className?: string }) {
  const { openNav } = useNavigation();

  return (
    <button
      onClick={openNav}
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-slate-900/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/25 text-white hover:bg-slate-800/90 hover:border-brand-500/60 hover:shadow-[0_0_24px_rgba(99,102,241,0.4)] active:scale-95 transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer group relative overflow-hidden shadow-lg shadow-black/20 ${className}`}
      title="Open Ops Navigation Drawer"
      aria-label="Open Navigation Drawer"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/25 via-white/15 to-transparent opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <NavMenuIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-100 group-hover:text-brand-300 transition-transform relative z-10" strokeWidth={2.8} />
    </button>
  );
}
