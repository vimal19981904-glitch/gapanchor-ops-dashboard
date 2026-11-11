'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { addOpsNotification } from '@/lib/notifications-store';

/**
 * OpsToastController
 * Automatically optimizes database saving toast notifications:
 * 1. On mobile (< 768px): limits display duration to 400ms (< 0.5s) and marks as micro-toast.
 * 2. Automatically logs every database save, status update, and pipeline event into
 *    the persistent OpsNotification store for the Bell icon activity logs.
 * 3. Preserves full duration for Undo action toasts (5000ms).
 */
export function OpsToastController() {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current || typeof window === 'undefined') return;
    isInitialized.current = true;

    // Preserve original sonner toast methods
    const originalSuccess = toast.success;
    const originalInfo = toast.info;

    // Monkey-patch toast.success
    toast.success = ((message: any, data?: any) => {
      const isMobile = window.innerWidth < 768;
      const text = typeof message === 'string' ? message : '';
      const isDbSave =
        text.toLowerCase().includes('database') ||
        text.toLowerCase().includes('saved lead') ||
        text.toLowerCase().includes('notes saved') ||
        text.toLowerCase().includes('status updated') ||
        text.toLowerCase().includes('quality set') ||
        text.toLowerCase().includes('saved');

      // Log DB activity into the Ops Notifications Store
      if (isDbSave) {
        try {
          addOpsNotification({
            title: 'Database Saved',
            description: text || 'Database record updated successfully',
            category: 'pipeline',
          });
        } catch {}
      }

      // If on mobile and it's a DB saving toast: set duration < 0.5s (400ms)
      const options = { ...data };
      if (isMobile && isDbSave) {
        options.duration = 400; // Less than half a second per user request
        options.className = `${options.className || ''} micro-db-toast`;
      }

      return originalSuccess(message, options);
    }) as any;

    // Monkey-patch toast.info
    toast.info = ((message: any, data?: any) => {
      const isMobile = window.innerWidth < 768;
      const text = typeof message === 'string' ? message : '';
      const isDbEvent =
        text.toLowerCase().includes('pipeline') ||
        text.toLowerCase().includes('prospect') ||
        text.toLowerCase().includes('removed');

      if (isDbEvent) {
        try {
          addOpsNotification({
            title: 'Pipeline Action',
            description: text || 'Pipeline state synchronized',
            category: 'pipeline',
          });
        } catch {}
      }

      const options = { ...data };
      if (isMobile && isDbEvent && !text.toLowerCase().includes('undo')) {
        options.duration = 450;
      }

      return originalInfo(message, options);
    }) as any;
  }, []);

  return null;
}

