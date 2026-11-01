import React from 'react';
import { Metadata } from 'next';
import { JarvisHolographicHud } from '@/components/jarvis/JarvisHolographicHud';

export const metadata: Metadata = {
  title: 'J.A.R.V.I.S. Holographic Core // GapAnchor Intelligence',
  description: 'Next-Generation Holographic Artificial Intelligence Executive Interface for GapAnchor Operations.',
};

export default function JarvisPage() {
  return (
    <main className="w-full min-h-screen bg-[#030712] overflow-hidden">
      <JarvisHolographicHud fullScreen={true} />
    </main>
  );
}
