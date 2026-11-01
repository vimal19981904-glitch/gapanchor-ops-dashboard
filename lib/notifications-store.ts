'use client';

export interface OpsNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category: 'lead' | 'pipeline' | 'sync' | 'system' | 'finance';
  read: boolean;
}

const STORAGE_KEY = 'gapanchor_recent_notifications';
const MAX_NOTIFICATIONS = 5;

const DEFAULT_NOTIFICATIONS: OpsNotification[] = [
  {
    id: 'notif-1',
    title: 'Pipeline Updated',
    description: 'Prospect stage change synchronized to database',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    category: 'pipeline',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Microsoft Graph Sync',
    description: 'Cloud intake checked for contact@gapanchor.com',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    category: 'sync',
    read: false,
  },
  {
    id: 'notif-3',
    title: 'Database Persistence Verified',
    description: 'All 398+ records synchronized with Azure Entra ID',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    category: 'system',
    read: true,
  },
  {
    id: 'notif-4',
    title: 'J.A.R.V.I.S. Voice Engine Active',
    description: 'Call intelligence and voice command processor online',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    category: 'system',
    read: true,
  },
  {
    id: 'notif-5',
    title: 'Finance Intelligence Ready',
    description: 'Revenue and operational metrics calculated for current period',
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    category: 'finance',
    read: true,
  },
];

/**
 * Retrieve the top 5 recent notifications from localStorage or defaults.
 */
export function getOpsNotifications(): OpsNotification[] {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
      return DEFAULT_NOTIFICATIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, MAX_NOTIFICATIONS);
    }
    return DEFAULT_NOTIFICATIONS;
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

/**
 * Log a new notification (keeps only the latest 5).
 */
export function addOpsNotification(
  notification: Omit<OpsNotification, 'id' | 'timestamp' | 'read'>
): OpsNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getOpsNotifications();
    const newEntry: OpsNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
      ...notification,
    };

    const updated = [newEntry, ...current].slice(0, MAX_NOTIFICATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Dispatch global event for reactive UI updates across all components
    window.dispatchEvent(
      new CustomEvent('gapanchor:notification-updated', {
        detail: { notifications: updated },
      })
    );

    return updated;
  } catch (err) {
    console.error('Failed to save ops notification:', err);
    return [];
  }
}

/**
 * Clear all notifications.
 */
export function clearOpsNotifications(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    window.dispatchEvent(
      new CustomEvent('gapanchor:notification-updated', {
        detail: { notifications: [] },
      })
    );
  } catch (err) {
    console.error('Failed to clear ops notifications:', err);
  }
}

/**
 * Mark all notifications as read.
 */
export function markAllNotificationsRead(): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getOpsNotifications();
    const updated = current.map((n) => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent('gapanchor:notification-updated', {
        detail: { notifications: updated },
      })
    );
  } catch (err) {
    console.error('Failed to mark notifications read:', err);
  }
}
