'use client';

import { useState, useEffect } from 'react';

/**
 * SSR-safe media-query hook for mobile viewport detection.
 * Defaults to max-width: 767px (matching mobile / < md breakpoint).
 */
export function useIsMobile(maxWidth = 767): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const updateMatch = () => setIsMobile(mediaQuery.matches);

    // Initial check
    updateMatch();

    // Event listener
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatch);
      return () => mediaQuery.removeEventListener('change', updateMatch);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(updateMatch);
      return () => mediaQuery.removeListener(updateMatch);
    }
  }, [maxWidth]);

  return isMobile;
}
