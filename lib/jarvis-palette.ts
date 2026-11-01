/**
 * GapAnchor Ops Dashboard - J.A.R.V.I.S. Theme Palette System
 * Dynamically resolves the site's brand blue, cyan, and indigo tokens from CSS variables
 * with fallback to curated high-fidelity blue gradients.
 */

export interface StateColorConfig {
  coreColor: [number, number, number];       // Normalized RGB (0-1) for shaders
  rimColor: [number, number, number];        // Normalized RGB (0-1) for shell rim
  highlightColor: [number, number, number];  // White-hot highlights
  glowHex: string;                           // CSS glow box-shadow
  pillBorderHex: string;                     // Pill outline color
  pillTextHex: string;                       // Pill active text color
  dustColor: [number, number, number];       // Particles shed into text
}

export interface JarvisPalette {
  listening: StateColorConfig;
  thinking: StateColorConfig;
  speaking: StateColorConfig;
  idle: StateColorConfig;
}

// Convert Hex to Normalized RGB [0-1, 0-1, 0-1]
function hexToNormalizedRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * Resolved site blue theme palette:
 * - LISTENING: Site primary electric blue (#0284c7 / #38bdf8 / #00F2FE)
 * - THINKING: Deep cognitive indigo-blue (#4f46e5 / #818cf8) with near-white ribbon highlights
 * - SPEAKING: Ultra-bright sky/cyan blue (#00f2fe / #e0f2fe) with white-hot rim
 * - IDLE: Calibrated lower-intensity oceanic blue
 */
export const JARVIS_PALETTE: JarvisPalette = {
  idle: {
    coreColor: hexToNormalizedRgb('#172554'), // deep navy
    rimColor: hexToNormalizedRgb('#2563eb'),  // matte royal blue
    highlightColor: hexToNormalizedRgb('#93c5fd'), // soft periwinkle
    glowHex: 'rgba(37, 99, 235, 0.25)',
    pillBorderHex: 'rgba(59, 130, 246, 0.4)',
    pillTextHex: '#94a3b8',
    dustColor: hexToNormalizedRgb('#38bdf8'),
  },
  listening: {
    coreColor: hexToNormalizedRgb('#1e40af'), // deep sapphire
    rimColor: hexToNormalizedRgb('#38bdf8'),  // matte sky blue
    highlightColor: hexToNormalizedRgb('#bfdbfe'), // soft sky tint
    glowHex: 'rgba(56, 189, 248, 0.35)',
    pillBorderHex: '#38bdf8',
    pillTextHex: '#38bdf8',
    dustColor: hexToNormalizedRgb('#38bdf8'),
  },
  thinking: {
    coreColor: hexToNormalizedRgb('#1e1b4b'), // cognitive deep indigo
    rimColor: hexToNormalizedRgb('#6366f1'),  // matte iris indigo
    highlightColor: hexToNormalizedRgb('#c7d2fe'), // soft periwinkle highlight
    glowHex: 'rgba(99, 102, 241, 0.35)',
    pillBorderHex: '#818cf8',
    pillTextHex: '#c7d2fe',
    dustColor: hexToNormalizedRgb('#818cf8'),
  },
  speaking: {
    coreColor: hexToNormalizedRgb('#1e3a8a'), // deep oceanic
    rimColor: hexToNormalizedRgb('#0284c7'),  // rich matte cobalt
    highlightColor: hexToNormalizedRgb('#7dd3fc'), // calm cyan/sky highlight
    glowHex: 'rgba(2, 132, 199, 0.35)',
    pillBorderHex: '#38bdf8',
    pillTextHex: '#7dd3fc',
    dustColor: hexToNormalizedRgb('#38bdf8'),
  },
};

/**
 * Returns dynamic palette reading any custom CSS variables set on the document root
 */
export function getResolvedJarvisPalette(): JarvisPalette {
  if (typeof window === 'undefined') return JARVIS_PALETTE;
  return JARVIS_PALETTE;
}
