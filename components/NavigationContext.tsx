'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import NavigationDrawer, { NavMenuIcon } from '@/components/NavigationDrawer';
import { OpsNotificationBell } from '@/components/navigation/OpsNotificationBell';

import PageTransition from '@/components/PageTransition';
import { UnauthorizedAlert } from '@/components/navigation/UnauthorizedAlert';

interface NavigationContextType {
  isOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isOpen: false,
  openNav: () => { },
  closeNav: () => { },
  toggleNav: () => { },
});

function DrawerBellPortal({ isOpen }: { isOpen: boolean }) {
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTargetEl(null);
      const actionsGroup = document.getElementById('ops-nav-header-actions');
      const closeBtn = document.querySelector('button[title="Close navigation"]');
      if (actionsGroup && closeBtn && actionsGroup.parentElement) {
        actionsGroup.parentElement.insertBefore(closeBtn, actionsGroup);
        actionsGroup.remove();
      }
      return;
    }

    const attachMount = () => {
      const closeBtn = document.querySelector('button[title="Close navigation"]') as HTMLElement | null;
      if (!closeBtn || !closeBtn.parentElement) return false;

      let actionsGroup = document.getElementById('ops-nav-header-actions');
      let mount = document.getElementById('ops-bell-portal-mount');

      if (!actionsGroup) {
        actionsGroup = document.createElement('div');
        actionsGroup.id = 'ops-nav-header-actions';
        actionsGroup.className = 'flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto';

        closeBtn.parentElement.insertBefore(actionsGroup, closeBtn);

        mount = document.createElement('div');
        mount.id = 'ops-bell-portal-mount';
        mount.className = 'flex items-center shrink-0';

        actionsGroup.appendChild(mount);
        actionsGroup.appendChild(closeBtn);
      }

      if (mount) {
        setTargetEl(mount);
        return true;
      }
      return false;
    };

    if (!attachMount()) {
      const timer = setTimeout(attachMount, 16);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !targetEl) return null;

  return createPortal(<OpsNotificationBell />, targetEl);
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openNav = () => setIsOpen(true);
  const closeNav = () => setIsOpen(false);
  const toggleNav = () => setIsOpen((prev) => !prev);

  return (
    <NavigationContext.Provider value={{ isOpen, openNav, closeNav, toggleNav }}>
      <React.Suspense fallback={null}>
        <UnauthorizedAlert />
      </React.Suspense>
      <UnauthorizedAlert />
      <PageTransition>{children}</PageTransition>
      <NavigationDrawer isOpen={isOpen} onClose={closeNav} />
      <DrawerBellPortal isOpen={isOpen} />
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
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/90 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200 dark:border-white/25 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/90 hover:border-blue-500/60 dark:hover:border-brand-500/60 hover:shadow-md dark:hover:shadow-[0_0_24px_rgba(99,102,241,0.4)] active:scale-95 transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer group relative overflow-hidden shadow-sm dark:shadow-lg dark:shadow-black/20 ${className}`}
      title="Open Ops Navigation Drawer"
      aria-label="Open Navigation Drawer"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 dark:from-brand-500/25 via-transparent dark:via-white/15 to-transparent opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <NavMenuIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-brand-300 transition-transform relative z-10" strokeWidth={2.8} />
    </button>
  );
}
