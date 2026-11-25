import React from 'react';
import { Metadata } from 'next';
import { JarvisHolographicHud } from '@/components/jarvis/JarvisHolographicHud';

export const metadata: Metadata = {
  title: 'J.A.R.V.I.S. Holographic Core // GapAnchor Intelligence',
  description: 'Next-Generation Holographic Artificial Intelligence Executive Interface for GapAnchor Operations.',
};

export default function JarvisPage() {
  return (
    /* J.A.R.V.I.S. Holographic HUD is strictly locked to dark mode in v1:
       The 3D WebGL particle sphere, laser HUD rings, and holographic audio waves require a dark canvas.
       TODO (Future): Design a high-contrast daylight holographic variant if requested. */
    <main className="dark w-full min-h-screen bg-[#030712] overflow-hidden" data-theme="dark">
      <JarvisHolographicHud fullScreen={true} />
    </main>
  );
}
