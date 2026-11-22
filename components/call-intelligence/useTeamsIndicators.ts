'use client';

import { useState, useEffect } from 'react';
import type { LeadIndicatorData } from '@/app/api/leads/teams-indicators/route';

let cachedIndicators: Record<string, LeadIndicatorData> | null = null;
let fetchPromise: Promise<Record<string, LeadIndicatorData>> | null = null;
const listeners = new Set<(data: Record<string, LeadIndicatorData>) => void>();

export function fetchTeamsIndicators(forceRefresh = false): Promise<Record<string, LeadIndicatorData>> {
  if (cachedIndicators && !forceRefresh) {
    return Promise.resolve(cachedIndicators);
  }

  if (fetchPromise && !forceRefresh) {
    return fetchPromise;
  }

  fetchPromise = fetch('/api/leads/teams-indicators')
    .then((res) => res.json())
    .then((data) => {
      if (data.success && data.indicators) {
        cachedIndicators = data.indicators;
        listeners.forEach((listener) => listener(cachedIndicators!));
        return cachedIndicators!;
      }
      return {};
    })
    .catch((err) => {
      console.warn('[useTeamsIndicators] Fetch error:', err);
      return {};
    })
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

export function useTeamsIndicators() {
  const [indicators, setIndicators] = useState<Record<string, LeadIndicatorData>>(cachedIndicators || {});
  const [loading, setLoading] = useState<boolean>(!cachedIndicators);

  useEffect(() => {
    const handleUpdate = (updated: Record<string, LeadIndicatorData>) => {
      setIndicators({ ...updated });
      setLoading(false);
    };

    listeners.add(handleUpdate);

    // Initial fetch if not cached
    if (!cachedIndicators) {
      fetchTeamsIndicators().then((data) => {
        setIndicators(data);
        setLoading(false);
      });
    }

    // Refresh listener for CRM lead updates or call syncs
    const handleRefresh = () => {
      fetchTeamsIndicators(true);
    };

    window.addEventListener('gapanchor:lead-updated', handleRefresh);
    window.addEventListener('gapanchor:call-updated', handleRefresh);
    window.addEventListener('gapanchor:indicators-updated', handleRefresh);

    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener('gapanchor:lead-updated', handleRefresh);
      window.removeEventListener('gapanchor:call-updated', handleRefresh);
      window.removeEventListener('gapanchor:indicators-updated', handleRefresh);
    };
  }, []);

  const getIndicator = (enquiryId: string): LeadIndicatorData | null => {
    return indicators[enquiryId] || null;
  };

  return {
    indicators,
    loading,
    getIndicator,
    refresh: () => fetchTeamsIndicators(true),
  };
}
