'use client';

import React from 'react';
import dynamic from 'next/dynamic';

export interface JarvisArcReactorProps {
  size?: number;
  state?: 'idle' | 'listening' | 'thinking' | 'speaking';
  statusText?: string;
  userTranscript?: string;
  replyText?: string;
  audioLevel?: number;
  className?: string;
}

// Dynamically import WebGL Particle Sphere with SSR disabled
const JarvisParticleSphere = dynamic(
  () =>
    import('@/components/jarvis/JarvisParticleSphere').then(
      (mod) => mod.JarvisParticleSphere
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-[180px] h-[180px] rounded-full border border-cyan-500/30 bg-slate-950/40 flex items-center justify-center animate-pulse">
        <span className="text-[10px] font-mono text-cyan-400">Loading Sphere…</span>
      </div>
    ),
  }
);

export function JarvisArcReactor({
  size = 180,
  state = 'idle',
  statusText,
  userTranscript = '',
  replyText = '',
  audioLevel = 0,
  className = '',
}: JarvisArcReactorProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <JarvisParticleSphere
        size={size}
        state={state}
        userTranscript={userTranscript}
        replyText={replyText || statusText}
        audioLevel={audioLevel}
      />
    </div>
  );
}
