'use client';

import React, { useMemo } from 'react';

export type JarvisOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'active';

interface JarvisOrbProps {
  state?: JarvisOrbState;
  size?: 'xs' | 'sm' | 'md' | 'lg' | number;
  className?: string;
  onClick?: () => void;
}

export function JarvisOrb({
  state = 'idle',
  size = 'sm',
  className = '',
  onClick,
}: JarvisOrbProps) {
  // Dimension in pixels (clean & compact)
  const pxSize = useMemo(() => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'xs':
        return 18;
      case 'sm':
        return 24;
      case 'lg':
        return 48;
      case 'md':
      default:
        return 32;
    }
  }, [size]);

  // Color & Gradient Palette by State
  const theme = useMemo(() => {
    switch (state) {
      case 'listening':
        return {
          coreGradient: 'from-cyan-300 via-sky-400 to-indigo-500',
          glowColor: 'rgba(0, 242, 254, 0.55)',
          pulseDuration: '1.2s',
          pingAura: true,
        };
      case 'thinking':
        return {
          coreGradient: 'from-violet-400 via-fuchsia-500 to-amber-400',
          glowColor: 'rgba(168, 85, 247, 0.65)',
          pulseDuration: '0.8s',
          pingAura: true,
        };
      case 'speaking':
        return {
          coreGradient: 'from-teal-300 via-cyan-400 to-emerald-400',
          glowColor: 'rgba(20, 241, 149, 0.5)',
          pulseDuration: '1.4s',
          pingAura: false,
        };
      case 'active':
        return {
          coreGradient: 'from-cyan-400 via-sky-500 to-indigo-600',
          glowColor: 'rgba(0, 242, 254, 0.45)',
          pulseDuration: '1.5s',
          pingAura: false,
        };
      case 'idle':
      default:
        return {
          coreGradient: 'from-cyan-400 via-sky-500 to-blue-600',
          glowColor: 'rgba(0, 242, 254, 0.35)',
          pulseDuration: '1.5s',
          pingAura: false,
        };
    }
  }, [state]);

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        onClick ? 'cursor-pointer group' : ''
      } ${className}`}
      style={{
        width: `${pxSize}px`,
        height: `${pxSize}px`,
      }}
      title={`AI Core [${state.toUpperCase()}]`}
    >
      {/* ─── Subtle Outer Glow Ping (Only when listening or thinking) ─── */}
      {theme.pingAura && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none animate-ping opacity-35"
          style={{ backgroundColor: theme.glowColor }}
        />
      )}

      {/* ─── Ambient Diffused Radial Aura ─── */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none transition-all duration-500"
        style={{
          background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 75%)`,
          filter: `blur(${Math.max(3, Math.round(pxSize * 0.2))}px)`,
          transform: 'scale(1.3)',
        }}
      />

      {/* ─── Clean, Translucent Crystal Glass Energy Orb (Zero dashed rings, Zero center dot) ─── */}
      <div
        className={`relative w-full h-full rounded-full bg-gradient-to-tr ${theme.coreGradient} transition-all duration-300 shadow-sm`}
        style={{
          boxShadow: `
            inset 0 0 ${Math.max(2, Math.round(pxSize * 0.35))}px rgba(255, 255, 255, 0.75),
            inset 0 0 ${Math.max(4, Math.round(pxSize * 0.5))}px ${theme.glowColor},
            0 0 ${Math.max(4, Math.round(pxSize * 0.4))}px ${theme.glowColor}
          `,
          animation: `cleanOrbBreathe ${theme.pulseDuration} ease-in-out infinite`,
        }}
      />

      {/* Global CSS Animation for Clean Ambient Breathing */}
      <style jsx global>{`
        @keyframes cleanOrbBreathe {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 4px rgba(0, 242, 254, 0.4));
          }
          50% {
            transform: scale(1.06);
            filter: drop-shadow(0 0 8px rgba(0, 242, 254, 0.75));
          }
        }
      `}</style>
    </div>
  );
}
