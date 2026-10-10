'use client';

import { useEffect } from 'react';

/**
 * Custom hook to lock body scrolling on mobile (iOS/Android) and desktop
 * when a modal or navigation drawer is active.
 *
 * Uses position: fixed + dynamic top offset to completely eliminate
 * iOS Safari background rubber-banding and scroll chaining while
 * preserving the user's scroll position when closed.
 */
export function useScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock || typeof window === 'undefined') return;

    // Capture current scroll position
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const body = document.body;
    const docEl = document.documentElement;

    const originalBodyPosition = body.style.position;
    const originalBodyTop = body.style.top;
    const originalBodyWidth = body.style.width;
    const originalBodyOverflow = body.style.overflow;
    const originalHtmlOverflow = docEl.style.overflow;

    // Apply viewport-level lock to prevent touch-move bubbling
    docEl.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      // Revert styles cleanly
      docEl.style.overflow = originalHtmlOverflow;
      body.style.position = originalBodyPosition;
      body.style.top = originalBodyTop;
      body.style.width = originalBodyWidth;
      body.style.overflow = originalBodyOverflow;

      // Restore exact scroll position
      window.scrollTo(0, scrollY);
    };
  }, [lock]);
}
