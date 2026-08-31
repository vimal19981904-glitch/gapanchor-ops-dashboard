import React from 'react';
import { cn } from '@/lib/utils';

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="glass-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-3 w-48" />
          </div>
        </div>
        <SkeletonBlock className="h-8 w-24 rounded-lg" />
      </div>
      <SkeletonBlock className="h-48 w-full rounded-xl" />
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-3/4" />
        <SkeletonBlock className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div className="glass-card space-y-3" style={{ padding: '20px' }}>
      <div className="flex justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-7 w-32" />
        </div>
        <SkeletonBlock className="h-10 w-10 rounded-xl" />
      </div>
      <SkeletonBlock className="h-3 w-40" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <SkeletonBlock className="h-10 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
