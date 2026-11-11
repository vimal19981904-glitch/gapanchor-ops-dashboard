'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { JARVIS_PALETTE, StateColorConfig } from '@/lib/jarvis-palette';
import { getLiveAudioFrequency, getLiveSpeechProgress } from '@/lib/jarvis-speech';

export type JarvisVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface JarvisParticleSphereProps {
  state?: JarvisVisualState;
  userTranscript?: string;
  replyText?: string;
  audioLevel?: number;
  onStateChange?: (state: JarvisVisualState) => void;
  showDevPanel?: boolean;
  className?: string;
  size?: number;
}

const DEFAULT_DEMO_TRANSCRIPT = 'What is the status of my latest Blue Yonder enquiries today?';
const DEFAULT_DEMO_REPLY =
  'Good morning. Three high priority Blue Yonder leads are active today, with batches ready for review.';

const FONT_FAMILY = '"Inter", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';

interface LaidOutWord {
  text: string;
  globalIdx: number;
  x: number;
  baselineY: number;
  width: number;
  centerX: number;
  centerY: number;
  weight: number;
}

interface CaptionWindow {
  startWordIdx: number;
  endWordIdx: number;
  words: LaidOutWord[];
}

interface GlyphSample {
  width: number;
  fontSize: number;
  points: { dx: number; dy: number; seedA: number; seedB: number; delay: number }[];
}

// ---------------------------------------------------------------------------
// 3D WebGL Particle Sphere Shaders (Idle / Listening / Thinking Strata & Silk Ribbon / Speaking Harmonics)
// ---------------------------------------------------------------------------

const sphereVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uStateMix;      // 0: idle/listening, 1: speaking
  uniform float uThinkMorph;    // 0 -> 1 envelope during thinking
  uniform float uStrataMix;     // early horizontal shear strata peak (F033)
  uniform float uRibbonMix;     // 3D multi-fold silky parametric ribbon (F038)
  uniform float uRadius;
  uniform float uPixelRatio;
  uniform float uAimX;          // subtle lean/pulse toward currently emitted word X (-1..1)

  attribute vec3 aSphereDir;
  attribute float aShellRadius;
  attribute vec4 aSeed;
  attribute vec2 aRibbonUV;     // u in [0..2PI], v in [-1..1] across ribbon threads

  varying float vFresnel;
  varying float vCrease;
  varying float vDepth;
  varying float vSeed;
  varying float vStrataEdge;

  vec3 ribbonSpine(float u, float t, float halfW, float halfH, float halfZ) {
    float wavePhase = t * 1.65;
    float x = (sin(u) * 0.96 + 0.16 * sin(3.0 * u)) * halfW;
    float y = (0.42 * sin(2.0 * u + 0.25 * sin(u + wavePhase * 0.5)) + 0.14 * cos(u - wavePhase)) * halfH;
    float z = (0.55 * cos(u) + 0.22 * sin(2.0 * u + wavePhase * 0.35)) * halfZ;
    return vec3(x, y, z);
  }

  void main() {
    vSeed = aSeed.x;
    float R = uRadius * aShellRadius;

    // 1. Base spherical harmonic & liquid breathing motion
    vec3 dir = normalize(aSphereDir);
    float sTheta = atan(dir.z, dir.x);
    float sPhi = acos(clamp(dir.y, -1.0, 1.0));

    // Gentle idle/listening living internal circulation & shimmer
    float rotSpeed = 0.24 + uStateMix * 0.08 + uThinkMorph * 0.16;
    float cRot = cos(uTime * rotSpeed);
    float sRot = sin(uTime * rotSpeed);
    vec3 rotatedDir = vec3(
      dir.x * cRot - dir.z * sRot,
      dir.y,
      dir.x * sRot + dir.z * cRot
    );

    // Smooth low-frequency organic vocal harmonics (F055 / F075 — broad lobes, zero spiky fuzz)
    float lobe1 = sin(rotatedDir.x * 2.4 + uTime * 2.1) * cos(rotatedDir.y * 2.1 - uTime * 1.4);
    float lobe2 = sin(rotatedDir.z * 2.8 - uTime * 2.6 + aSeed.y * 0.25) * cos(rotatedDir.x * 1.9 + uTime * 1.7);
    float lobe3 = sin(sPhi * 3.0 - uTime * 3.1) * cos(sTheta * 2.0 + uTime * 1.6);

    float voiceStrength = (0.045 + uAudioLevel * 0.22) * uStateMix;
    // Living ambient shimmer & subtle breathing quiver in idle/listening states
    float idleFactor = (1.0 - uStateMix) * (1.0 - uThinkMorph);
    float idleBreath = sin(uTime * 1.9 + aSeed.z * 6.28) * 0.022 + sin(uTime * 3.6 + sPhi * 3.0 + aSeed.y * 4.0) * 0.014 * idleFactor;
    float idleHarmonic = (lobe1 * 0.4 + lobe2 * 0.35 + lobe3 * 0.25) * (0.024 + uAudioLevel * 0.05) * idleFactor;
    float radialScale = 1.0 + idleBreath + idleHarmonic + (lobe1 * 0.45 + lobe2 * 0.35 + lobe3 * 0.28) * voiceStrength;

    // Subtle tangent micro-vibration/shaking shimmer on each particle so idle orb looks alive
    vec3 idleQuiver = vec3(
      sin(uTime * 7.4 + aSeed.x * 38.0 + dir.y * 4.0),
      cos(uTime * 6.6 + aSeed.y * 34.0 + dir.z * 4.0),
      sin(uTime * 7.9 + aSeed.z * 41.0 + dir.x * 4.0)
    ) * (uRadius * 0.013 * idleFactor);

    // Subtle downward vocal gravitas & horizontal recoil during word emission
    vec3 spherePos = rotatedDir * R * radialScale + idleQuiver;
    float bottomMask = smoothstep(-0.15, -0.95, rotatedDir.y);
    spherePos.y -= bottomMask * uStateMix * (0.04 + uAudioLevel * 0.07) * uRadius;
    spherePos.x += bottomMask * uStateMix * uAimX * (0.035 + uAudioLevel * 0.05) * uRadius;

    // 2. Thinking Stage 1: 4-band horizontal shear wave strata (F033)
    float yNorm = clamp(rotatedDir.y, -0.999, 0.999);
    float bandVal = (yNorm + 1.0) * 2.0; // 4 horizontal strata across diameter
    float bandIdx = floor(bandVal);
    float bandFrac = fract(bandVal);
    float bandSign = mod(bandIdx, 2.0) < 0.5 ? 1.0 : -1.0;

    float strataShift = bandSign * (0.28 + 0.18 * sin(uTime * 2.4 + bandIdx * 1.4)) * uRadius;
    float strataWaveY = sin(rotatedDir.x * 3.2 + bandSign * uTime * 2.2) * 0.065 * uRadius;
    vec3 strataPos = vec3(
      spherePos.x * 1.18 + strataShift,
      (bandIdx - 1.5 + (bandFrac - 0.5) * 0.42) * (uRadius * 0.48) + strataWaveY,
      spherePos.z * 0.85
    );
    vStrataEdge = smoothstep(0.18, 0.5, abs(bandFrac - 0.5)) * uStrataMix;

    // 3. Thinking Stage 2: Silky multi-fold 3D parametric ribbon sheets (F038)
    float u = aRibbonUV.x + uTime * 0.48;
    float v = aRibbonUV.y;
    float rHalfW = uRadius * 1.38;
    float rHalfH = uRadius * 0.72;
    float rHalfZ = uRadius * 0.62;

    vec3 c0 = ribbonSpine(u, uTime, rHalfW, rHalfH, rHalfZ);
    vec3 c1 = ribbonSpine(u + 0.04, uTime, rHalfW, rHalfH, rHalfZ);
    vec3 tangent = normalize(c1 - c0);
    vec3 upHint = normalize(vec3(0.0, cos(u * 0.5 + 0.4), sin(u * 0.5 + 0.4)));
    vec3 orthoA = normalize(cross(tangent, upHint));
    vec3 orthoB = normalize(cross(tangent, orthoA));

    // Rotating pleat twist along u creates crisp translucent edge folds
    float twist = u * 1.5 + 0.55 * sin(u * 2.0 - uTime * 1.4);
    vec3 binormal = cos(twist) * orthoA + sin(twist) * orthoB;
    float sheetWidth = uRadius * (0.34 + 0.08 * sin(u * 3.0 + uTime * 2.1));
    float sheetRipple = sin(v * 3.14159 * 2.0 + u * 2.0 - uTime * 3.2) * uRadius * 0.035;
    vec3 ribbonPos = c0 + binormal * (v * sheetWidth) + orthoB * sheetRipple;
    // Slight thickness variation across threads
    ribbonPos += orthoA * ((aSeed.w - 0.5) * uRadius * 0.018);

    // 4. Unified smooth stage blend: Sphere -> Strata -> Silky Ribbon -> Sphere
    vec3 intermediatePos = mix(spherePos, strataPos, uStrataMix);
    vec3 finalPos = mix(intermediatePos, ribbonPos, uRibbonMix);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // View-space Fresnel rim + edge-on crease boost
    vec3 viewPos = normalize(-mvPosition.xyz);
    vec3 nSphere = normalize((modelViewMatrix * vec4(normalize(finalPos + vec3(0.0001)), 0.0)).xyz);
    float fresnel = pow(1.0 - abs(dot(nSphere, viewPos)), 1.95);
    vFresnel = clamp(fresnel * 1.15, 0.0, 1.0);

    // Highlight edge-on ribbon folds (when sheet binormal aligns along view vector)
    vec3 viewBinorm = normalize((modelViewMatrix * vec4(binormal, 0.0)).xyz);
    float crease = pow(abs(dot(viewBinorm, viewPos)), 2.2);
    vCrease = crease * uRibbonMix;
    vDepth = clamp((-mvPosition.z - 220.0) / 140.0, 0.0, 1.0);

    // Fine granular sand point sizes (tight on shell, sparkling along creases)
    float baseSize = mix(1.45, 2.25, aSeed.y);
    float thinkBoost = 1.0 + vCrease * 0.45 + vStrataEdge * 0.3;
    float voiceSize = 1.0 + uAudioLevel * 0.25 * uStateMix * vFresnel;
    gl_PointSize = clamp(baseSize * thinkBoost * voiceSize * uPixelRatio * (275.0 / -mvPosition.z), 1.1, 4.4 * uPixelRatio);
  }
`;

const sphereFragmentShader = /* glsl */ `
  uniform vec3 uCoreColor;
  uniform vec3 uRimColor;
  uniform vec3 uHighlightColor;
  uniform float uTime;
  uniform float uStateMix;
  uniform float uThinkMorph;
  uniform float uAudioLevel;

  varying float vFresnel;
  varying float vCrease;
  varying float vDepth;
  varying float vSeed;
  varying float vStrataEdge;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float softDot = smoothstep(0.5, 0.08, dist);

    vec3 col = mix(uCoreColor, uRimColor, smoothstep(0.18, 0.9, vFresnel));
    float hiMix = smoothstep(0.65, 1.0, vFresnel) * 0.5 + vCrease * 0.72 + vStrataEdge * 0.55;
    col = mix(col, uHighlightColor, clamp(hiMix, 0.0, 0.92));

    // Hollow dark interior with glowing rim + shimmering ribbon creases + gentle living twinkle
    float hollowMask = mix(0.18, 0.92, smoothstep(0.14, 0.88, vFresnel));
    float thinkAlpha = mix(hollowMask, 0.34 + vCrease * 0.65 + vStrataEdge * 0.45, max(uThinkMorph, 0.0));
    float speakAlphaBoost = 1.0 + uStateMix * uAudioLevel * 0.38;
    float depthFade = mix(1.0, 0.45, vDepth);
    float twinkle = 0.86 + 0.14 * sin(uTime * 3.8 + vSeed * 28.0);

    float alpha = softDot * thinkAlpha * speakAlphaBoost * depthFade * twinkle * (0.48 + 0.52 * vSeed);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.88));
  }
`;

// ---------------------------------------------------------------------------
// Text Wrapping, Word Glyph Sampling & Caption Pagination Helpers
// ---------------------------------------------------------------------------

const GLYPH_CACHE_MAX = 220;
const glyphSampleCache = new Map<string, GlyphSample>();

function hashFloat(str: string, idx: number): number {
  let h = 2166136261 ^ idx;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function getWordGlyphSample(word: string, fontSize: number, fontStr: string): GlyphSample {
  const key = `${fontSize}|${word}`;
  const cached = glyphSampleCache.get(key);
  if (cached) return cached;

  const off = document.createElement('canvas');
  const ctx = off.getContext('2d');
  if (!ctx) {
    return { width: word.length * fontSize * 0.55, fontSize, points: [] };
  }

  // Render at 2x supersampled resolution so letter stems sample crisply
  const scale = 2;
  ctx.font = fontStr;
  const measuredW = Math.max(4, Math.ceil(ctx.measureText(word).width));
  const pad = 4;
  const w = (measuredW + pad * 2) * scale;
  const h = Math.ceil(fontSize * 1.9) * scale;
  off.width = w;
  off.height = h;

  ctx.scale(scale, scale);
  ctx.font = fontStr;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  const localBaselineY = Math.round(fontSize * 1.32);
  ctx.fillText(word, pad, localBaselineY);

  const imgData = ctx.getImageData(0, 0, w, h).data;
  const rawPoints: { dx: number; dy: number; seedA: number; seedB: number; delay: number }[] = [];

  // Sample every 2 pixels in 2x space -> exact 1px spacing in CSS coordinates
  const step = 2;
  let ptIdx = 0;
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const a = imgData[(py * w + px) * 4 + 3];
      if (a > 64) {
        const dx = px / scale - pad;
        const dy = py / scale - localBaselineY;
        const seedA = hashFloat(word, ptIdx * 3 + 1);
        const seedB = hashFloat(word, ptIdx * 3 + 2);
        const delay = (dx / Math.max(measuredW, 8)) * 0.12 + seedA * 0.08;
        rawPoints.push({ dx, dy, seedA, seedB, delay });
        ptIdx++;
      }
    }
  }

  // Allow denser fine micro-grains per word for sand-like letter formation
  const maxPts = 320;
  let finalPoints = rawPoints;
  if (rawPoints.length > maxPts) {
    const stride = rawPoints.length / maxPts;
    finalPoints = [];
    for (let i = 0; i < maxPts; i++) {
      finalPoints.push(rawPoints[Math.floor(i * stride)]);
    }
  }

  const sample: GlyphSample = { width: measuredW, fontSize, points: finalPoints };
  if (glyphSampleCache.size >= GLYPH_CACHE_MAX) {
    const firstKey = glyphSampleCache.keys().next().value;
    if (firstKey) glyphSampleCache.delete(firstKey);
  }
  glyphSampleCache.set(key, sample);
  return sample;
}

function buildCaptionWindows(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  centerX: number,
  topBaselineY: number,
  lineHeight: number,
  fontStr: string
): CaptionWindow[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  ctx.font = fontStr;
  const rawWords = cleaned.split(' ');
  const spaceW = ctx.measureText(' ').width;

  // Step 1: Break into clean horizontal lines within maxWidth
  interface TempLine {
    words: { text: string; globalIdx: number; width: number }[];
    totalWidth: number;
  }
  const lines: TempLine[] = [];
  let currentLine: { text: string; globalIdx: number; width: number }[] = [];
  let currentW = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const wText = rawWords[i];
    const wWidth = ctx.measureText(wText).width;
    const needed = currentLine.length === 0 ? wWidth : currentW + spaceW + wWidth;
    if (currentLine.length > 0 && needed > maxWidth) {
      lines.push({ words: currentLine, totalWidth: currentW });
      currentLine = [{ text: wText, globalIdx: i, width: wWidth }];
      currentW = wWidth;
    } else {
      currentLine.push({ text: wText, globalIdx: i, width: wWidth });
      currentW = needed;
    }
  }
  if (currentLine.length > 0) {
    lines.push({ words: currentLine, totalWidth: currentW });
  }

  // Step 2: Group lines into short readable windows (up to 2 lines, max ~8 words, break on strong sentence ends)
  const windows: CaptionWindow[] = [];
  let lineIdx = 0;
  while (lineIdx < lines.length) {
    const winLines: TempLine[] = [lines[lineIdx]];
    lineIdx++;

    if (lineIdx < lines.length) {
      const firstLineLastWord = winLines[0].words[winLines[0].words.length - 1]?.text || '';
      const combinedCount = winLines[0].words.length + lines[lineIdx].words.length;
      if (!/[.!?]$/.test(firstLineLastWord) && combinedCount <= 12) {
        winLines.push(lines[lineIdx]);
        lineIdx++;
      }
    }

    const laidOut: LaidOutWord[] = [];
    const verticalShift = winLines.length === 1 ? Math.round(lineHeight * 0.35) : 0;

    winLines.forEach((ln, li) => {
      let curX = centerX - ln.totalWidth / 2;
      const baselineY = topBaselineY + li * lineHeight + verticalShift;
      ln.words.forEach((wd) => {
        laidOut.push({
          text: wd.text,
          globalIdx: wd.globalIdx,
          x: curX,
          baselineY,
          width: wd.width,
          centerX: curX + wd.width / 2,
          centerY: baselineY - 5,
          weight: Math.max(3, wd.text.length + 2.5),
        });
        curX += wd.width + spaceW;
      });
    });

    if (laidOut.length > 0) {
      windows.push({
        startWordIdx: laidOut[0].globalIdx,
        endWordIdx: laidOut[laidOut.length - 1].globalIdx,
        words: laidOut,
      });
    }
  }

  return windows;
}

function wrapListeningLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontStr: string
): { words: { text: string; idx: number; width: number }[]; totalWidth: number }[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  ctx.font = fontStr;
  const rawWords = cleaned.split(' ');
  const spaceW = ctx.measureText(' ').width;

  const lines: { words: { text: string; idx: number; width: number }[]; totalWidth: number }[] = [];
  let line: { text: string; idx: number; width: number }[] = [];
  let lineW = 0;

  rawWords.forEach((w, idx) => {
    const ww = ctx.measureText(w).width;
    const needed = line.length === 0 ? ww : lineW + spaceW + ww;
    if (line.length > 0 && needed > maxWidth) {
      lines.push({ words: line, totalWidth: lineW });
      line = [{ text: w, idx, width: ww }];
      lineW = ww;
    } else {
      line.push({ text: w, idx, width: ww });
      lineW = needed;
    }
  });
  if (line.length > 0) lines.push({ words: line, totalWidth: lineW });

  // Keep only the latest 2 lines so it stays sleek beneath the orb
  return lines.slice(-2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JarvisParticleSphere({
  state = 'idle',
  userTranscript = '',
  replyText = '',
  audioLevel = 0.08,
  onStateChange,
  showDevPanel = false,
  className = '',
  size = 190,
}: JarvisParticleSphereProps) {
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [stageDims, setStageDims] = useState<{ w: number; h: number }>({
    w: size >= 185 ? 460 : 280,
    h: Math.max(295, Math.round(size * 1.52)),
  });

  // Dev simulator controls
  const [isDevOpen, setIsDevOpen] = useState(showDevPanel);
  const [devState, setDevState] = useState<JarvisVisualState>(state);
  const [devTranscript, setDevTranscript] = useState(DEFAULT_DEMO_TRANSCRIPT);
  const [devReply, setDevReply] = useState(DEFAULT_DEMO_REPLY);
  const [simRunId, setSimRunId] = useState(0);

  const activeState: JarvisVisualState = isDevOpen ? devState : state;
  const effectiveTranscript = isDevOpen ? devTranscript : userTranscript;
  const effectiveReply = isDevOpen ? devReply : replyText;

  // Refs synced to 60fps loop
  const activeStateRef = useRef<JarvisVisualState>(activeState);
  const transcriptRef = useRef(effectiveTranscript);
  const replyRef = useRef(effectiveReply);
  const audioLevelRef = useRef(audioLevel);
  const stageDimsRef = useRef(stageDims);
  const sizePropRef = useRef(size);
  const simRunIdRef = useRef(simRunId);

  activeStateRef.current = activeState;
  transcriptRef.current = effectiveTranscript;
  replyRef.current = effectiveReply;
  audioLevelRef.current = audioLevel;
  stageDimsRef.current = stageDims;
  sizePropRef.current = size;
  simRunIdRef.current = simRunId;

  // Measure container dynamically across mobile & desktop viewports
  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateDims = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40) {
        const w = Math.round(rect.width);
        const h = Math.max(280, Math.round(size * 1.52));
        setStageDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  // Shared 60fps WebGL + HiDPI 2D Overlay Particle Engine
  useEffect(() => {
    const webglCanvas = webglCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!webglCanvas || !overlayCanvas) return;

    let rafId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let disposed = false;

    // -----------------------------------------------------------------------
    // Initialize Three.js WebGL Sphere & Thinking Ribbon Geometry
    // -----------------------------------------------------------------------
    const scene = new THREE.Scene();
    const fov = 38;
    const camZ = 300;
    const initDims = stageDimsRef.current;
    const camera = new THREE.PerspectiveCamera(fov, initDims.w / initDims.h, 1, 1000);
    camera.position.set(0, 0, camZ);

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: webglCanvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(initDims.w, initDims.h, false);
    renderer.setClearColor(0x000000, 0);

    const N = 24000;
    const positions = new Float32Array(N * 3);
    const aSphereDir = new Float32Array(N * 3);
    const aShellRadius = new Float32Array(N);
    const aSeed = new Float32Array(N * 4);
    const aRibbonUV = new Float32Array(N * 2);

    const ribbonStrands = 30;
    const pointsPerStrand = N / ribbonStrands;

    for (let i = 0; i < N; i++) {
      // Fibonacci + subtle jitter sphere distribution
      const y = 1 - (i / (N - 1)) * 2;
      const rXZ = Math.sqrt(Math.max(0, 1 - y * y));
      const golden = i * 2.399963229728653;
      const sx = Math.cos(golden) * rXZ;
      const sy = y;
      const sz = Math.sin(golden) * rXZ;

      aSphereDir[i * 3] = sx;
      aSphereDir[i * 3 + 1] = sy;
      aSphereDir[i * 3 + 2] = sz;
      positions[i * 3] = sx;
      positions[i * 3 + 1] = sy;
      positions[i * 3 + 2] = sz;

      // Dense hollow outer rim (~86% outer sand grains, ~14% soft inner eddies)
      const s0 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const s1 = ((Math.sin(i * 78.233 + 1.3) * 19341.21) % 1 + 1) % 1;
      const s2 = ((Math.sin(i * 39.425 + 4.7) * 82913.7) % 1 + 1) % 1;
      const s3 = ((Math.sin(i * 91.117 + 8.1) * 51827.3) % 1 + 1) % 1;

      aShellRadius[i] = s0 > 0.14 ? 0.93 + s1 * 0.08 : 0.48 + s1 * 0.45;
      aSeed[i * 4] = s0;
      aSeed[i * 4 + 1] = s1;
      aSeed[i * 4 + 2] = s2;
      aSeed[i * 4 + 3] = s3;

      // Parametric silky ribbon UV grid (strand index -> v, longitudinal position -> u)
      const strandIdx = Math.floor(i / pointsPerStrand);
      const alongIdx = i % pointsPerStrand;
      const u = (alongIdx / pointsPerStrand) * Math.PI * 2 + (s2 - 0.5) * 0.012;
      const v = (strandIdx / (ribbonStrands - 1)) * 2 - 1 + (s3 - 0.5) * 0.03;
      aRibbonUV[i * 2] = u;
      aRibbonUV[i * 2 + 1] = v;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSphereDir', new THREE.BufferAttribute(aSphereDir, 3));
    geometry.setAttribute('aShellRadius', new THREE.BufferAttribute(aShellRadius, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 4));
    geometry.setAttribute('aRibbonUV', new THREE.BufferAttribute(aRibbonUV, 2));

    const paletteInit = JARVIS_PALETTE[activeStateRef.current] || JARVIS_PALETTE.idle;
    const uniforms = {
      uTime: { value: 0 },
      uAudioLevel: { value: 0.08 },
      uStateMix: { value: 0 },
      uThinkMorph: { value: 0 },
      uStrataMix: { value: 0 },
      uRibbonMix: { value: 0 },
      uRadius: { value: 48 },
      uPixelRatio: { value: dpr },
      uAimX: { value: 0 },
      uCoreColor: { value: new THREE.Vector3(...paletteInit.coreColor) },
      uRimColor: { value: new THREE.Vector3(...paletteInit.rimColor) },
      uHighlightColor: { value: new THREE.Vector3(...paletteInit.highlightColor) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: sphereVertexShader,
      fragmentShader: sphereFragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // -----------------------------------------------------------------------
    // Synchronized Speech Progress & 2D Particle-to-Word Animation State
    // -----------------------------------------------------------------------
    let prevTime = performance.now();
    let elapsed = 0;

    // Smoothed WebGL parameters
    let curCore = new THREE.Vector3(...paletteInit.coreColor);
    let curRim = new THREE.Vector3(...paletteInit.rimColor);
    let curHi = new THREE.Vector3(...paletteInit.highlightColor);
    let curSpeakMix = 0;
    let curThinkElapsed = 0;
    let wasThinking = false;
    let curThinkMorph = 0;
    let curStrataMix = 0;
    let curRibbonMix = 0;
    let curAimX = 0;

    // Listening progressive reveal tracker
    let lastListeningText = '';
    const wordAppearTimes = new Map<number, number>();
    let fadingTranscriptText = '';
    let transcriptFadeAlpha = 0;

    // Speaking word-by-word timeline state
    let lastSpeechKey = '';
    let lastSessionId = -1;
    let cachedWindows: CaptionWindow[] = [];
    let cachedWordsMeta: { text: string; weight: number }[] = [];
    let totalWeight = 1;
    let localSpeakClock = 0;
    let lastBoundaryIdx = -1;
    let boundaryBlendStart = 0;
    let currentWindowIdx = 0;
    let windowCrossfadeAlpha = 1;
    let activeResizeKey = '';

    const updateCanvasSizing = (w: number, h: number) => {
      const sizeKey = `${w}x${h}@${dpr}`;
      if (sizeKey === activeResizeKey || !renderer) return;
      activeResizeKey = sizeKey;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      overlayCanvas.width = Math.round(w * dpr);
      overlayCanvas.height = Math.round(h * dpr);
    };

    const animate = (now: number) => {
      if (disposed || !renderer) return;
      rafId = requestAnimationFrame(animate);

      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;
      elapsed += dt;

      const dims = stageDimsRef.current;
      const measuredW = stageContainerRef.current?.clientWidth || dims.w;
      const stageW = Math.max(240, measuredW);
      const stageH = Math.max(260, dims.h);
      updateCanvasSizing(stageW, stageH);

      // Exact camera-projected pixel <-> world unit conversion
      const halfWorldH = camZ * Math.tan((fov * Math.PI) / 360);
      const pxPerWorld = stageH / (2 * halfWorldH);
      const maxMobileR = Math.min(76, Math.round(stageW * 0.215));
      const orbRadiusPx = Math.min(maxMobileR, Math.round(sizePropRef.current * 0.39));
      const orbCenterX = stageW * 0.5;
      const orbCenterY = Math.round(Math.max(orbRadiusPx + 18, stageH * 0.35));
      const orbWorldY = (stageH * 0.5 - orbCenterY) / pxPerWorld;
      const orbWorldRadius = orbRadiusPx / pxPerWorld;

      particleSystem.position.set(0, orbWorldY, 0);
      uniforms.uRadius.value = orbWorldRadius;
      uniforms.uTime.value = elapsed;

      const st = activeStateRef.current;
      const liveSpeech = getLiveSpeechProgress();
      const liveFreq = getLiveAudioFrequency();

      // Target colors
      const targetPal: StateColorConfig = JARVIS_PALETTE[st] || JARVIS_PALETTE.idle;
      curCore.lerp(new THREE.Vector3(...targetPal.coreColor), dt * 4.5);
      curRim.lerp(new THREE.Vector3(...targetPal.rimColor), dt * 4.5);
      curHi.lerp(new THREE.Vector3(...targetPal.highlightColor), dt * 4.5);
      uniforms.uCoreColor.value.copy(curCore);
      uniforms.uRimColor.value.copy(curRim);
      uniforms.uHighlightColor.value.copy(curHi);

      // Live vocal energy
      let targetAudio = audioLevelRef.current;
      if (liveFreq > 0.02) {
        targetAudio = Math.max(targetAudio * 0.35, liveFreq);
      } else if (st === 'speaking') {
        // Organic syllabic pulse when simulated / silent playback
        targetAudio = 0.42 + 0.28 * Math.abs(Math.sin(elapsed * 7.2)) * (0.6 + 0.4 * Math.sin(elapsed * 3.1));
      } else if (st === 'listening') {
        targetAudio = 0.24 + 0.12 * Math.sin(elapsed * 3.2);
      } else if (st === 'idle') {
        targetAudio = 0.14 + 0.08 * Math.sin(elapsed * 2.4) * Math.cos(elapsed * 1.1);
      }
      uniforms.uAudioLevel.value += (targetAudio - uniforms.uAudioLevel.value) * Math.min(1, dt * 11);

      // State morph envelopes
      const targetSpeakMix = st === 'speaking' ? 1 : 0;
      curSpeakMix += (targetSpeakMix - curSpeakMix) * Math.min(1, dt * 5.2);
      uniforms.uStateMix.value = curSpeakMix;

      if (st === 'thinking') {
        if (!wasThinking) {
          wasThinking = true;
          curThinkElapsed = 0;
        }
        curThinkElapsed += dt;
        // Phase 1 (0 -> 0.48s): Horizontal shear wave strata (F033)
        // Phase 2 (0.28s+): Unfurl cleanly into 3D multi-fold silky ribbon (F038)
        const strataPeak =
          Math.min(1, curThinkElapsed / 0.24) * (1 - Math.min(1, Math.max(0, (curThinkElapsed - 0.42) / 0.52)));
        const ribbonRise = Math.min(1, Math.max(0, (curThinkElapsed - 0.24) / 0.55));
        curThinkMorph += (1 - curThinkMorph) * Math.min(1, dt * 6.0);
        curStrataMix += (strataPeak - curStrataMix) * Math.min(1, dt * 7.0);
        curRibbonMix += (ribbonRise - curRibbonMix) * Math.min(1, dt * 4.8);
      } else {
        wasThinking = false;
        curThinkMorph += (0 - curThinkMorph) * Math.min(1, dt * 6.5);
        curStrataMix += (0 - curStrataMix) * Math.min(1, dt * 7.5);
        curRibbonMix += (0 - curRibbonMix) * Math.min(1, dt * 6.5);
      }
      uniforms.uThinkMorph.value = curThinkMorph;
      uniforms.uStrataMix.value = curStrataMix;
      uniforms.uRibbonMix.value = curRibbonMix;

      // ---------------------------------------------------------------------
      // Render Three.js Scene
      // ---------------------------------------------------------------------
      renderer.render(scene, camera);

      // ---------------------------------------------------------------------
      // Render Synchronized 2D Overlay: Listening Transcript & Speaking Word-by-Word Dust
      // ---------------------------------------------------------------------
      const ctx = overlayCanvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, stageW, stageH);

      const fontSize = stageW < 340 ? 14 : 16;
      const lineHeight = stageW < 340 ? 22 : 24;
      const fontStr = `500 ${fontSize}px ${FONT_FAMILY}`;
      // Narrow centered zone directly beneath the orb so particles pour vertically in a clean plume
      const maxTextWidth = Math.min(stageW - 40, 295);
      const captionTopBaselineY = orbCenterY + orbRadiusPx + Math.max(38, Math.round(stageH * 0.145));

      // Handle LISTENING transcript + smooth Thinking fade-out (F011 -> F046)
      const listeningText = transcriptRef.current.trim();
      if (st === 'listening' && listeningText) {
        if (listeningText !== lastListeningText) {
          const words = listeningText.split(/\s+/);
          words.forEach((_, idx) => {
            if (!wordAppearTimes.has(idx)) {
              // Slight stagger if multiple words arrive in one chunk
              wordAppearTimes.set(idx, elapsed + idx * 0.04);
            }
          });
          lastListeningText = listeningText;
        }
        fadingTranscriptText = listeningText;
        transcriptFadeAlpha = Math.min(1, transcriptFadeAlpha + dt * 6);
      } else if (st === 'listening' && !listeningText) {
        lastListeningText = '';
        wordAppearTimes.clear();
        fadingTranscriptText = '';
        transcriptFadeAlpha = 0;
      } else if (st === 'thinking' && fadingTranscriptText && transcriptFadeAlpha > 0.01) {
        transcriptFadeAlpha = Math.max(0, transcriptFadeAlpha - dt * 2.5);
      } else {
        transcriptFadeAlpha = 0;
        if (st !== 'listening') {
          lastListeningText = '';
          wordAppearTimes.clear();
          fadingTranscriptText = '';
        }
      }

      if (transcriptFadeAlpha > 0.01 && fadingTranscriptText && st !== 'speaking') {
        const lines = wrapListeningLines(ctx, fadingTranscriptText, maxTextWidth, fontStr);
        ctx.font = fontStr;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const spaceW = ctx.measureText(' ').width;
        const vOffset = lines.length === 1 ? Math.round(lineHeight * 0.35) : 0;

        lines.forEach((ln, li) => {
          let wx = orbCenterX - ln.totalWidth / 2;
          const wy = captionTopBaselineY + li * lineHeight + vOffset;
          ln.words.forEach((wd) => {
            const appearT = wordAppearTimes.get(wd.idx) ?? elapsed;
            const age = Math.max(0, elapsed - appearT);
            // Smooth word entrance + newer words glow brighter
            const enterAlpha = Math.min(1, age / 0.24);
            const freshness = Math.max(0, 1 - age / 0.9);
            const baseOpacity = 0.62 + freshness * 0.38;
            ctx.fillStyle =
              freshness > 0.2
                ? `rgba(224, 242, 254, ${(enterAlpha * baseOpacity * transcriptFadeAlpha).toFixed(3)})`
                : `rgba(203, 213, 225, ${(enterAlpha * 0.65 * transcriptFadeAlpha).toFixed(3)})`;
            ctx.fillText(wd.text, wx, wy);
            wx += wd.width + spaceW;
          });
        });
      }

      // Handle SPEAKING: Word-by-Word Dust Pouring from Orb -> Swirling -> Locking into Words
      const activeSpeechText =
        liveSpeech.isPlaying && liveSpeech.chunkText.trim() ? liveSpeech.chunkText.trim() : replyRef.current.trim();

      let targetAimX = 0;

      if (st === 'speaking' && activeSpeechText) {
        const speechKey = `${activeSpeechText}|${stageW}|${fontSize}|${simRunIdRef.current}`;
        const sessionChanged = liveSpeech.isPlaying && liveSpeech.sessionId !== lastSessionId;

        if (speechKey !== lastSpeechKey || sessionChanged) {
          lastSpeechKey = speechKey;
          lastSessionId = liveSpeech.sessionId;
          cachedWindows = buildCaptionWindows(
            ctx,
            activeSpeechText,
            maxTextWidth,
            orbCenterX,
            captionTopBaselineY,
            lineHeight,
            fontStr
          );
          cachedWordsMeta = [];
          totalWeight = 0;
          cachedWindows.forEach((win) =>
            win.words.forEach((w) => {
              cachedWordsMeta.push({ text: w.text, weight: w.weight });
              totalWeight += w.weight;
            })
          );
          totalWeight = Math.max(1, totalWeight);
          localSpeakClock = 0;
          lastBoundaryIdx = -1;
          boundaryBlendStart = elapsed;
          currentWindowIdx = 0;
          windowCrossfadeAlpha = 1;
        }

        localSpeakClock += dt;

        // Compute continuous fractional word position [0 .. totalWords]
        const totalWords = cachedWordsMeta.length;
        let floatWordPos = totalWords;

        if (totalWords > 0) {
          if (liveSpeech.isPlaying) {
            if (liveSpeech.spokenWordIndex >= 0) {
              // Web Speech API word-boundary mode: smooth 240ms ramp across the active word
              if (liveSpeech.spokenWordIndex !== lastBoundaryIdx) {
                lastBoundaryIdx = liveSpeech.spokenWordIndex;
                boundaryBlendStart = elapsed;
              }
              const subProg = Math.min(0.96, (elapsed - boundaryBlendStart) / 0.25);
              floatWordPos = Math.min(totalWords, liveSpeech.spokenWordIndex + subProg);
            } else {
              // Real neural/OpenAI AudioContext or HTMLAudio progress weighted by word length
              const targetW = liveSpeech.progress * totalWeight;
              let acc = 0;
              let mapped = totalWords;
              for (let wi = 0; wi < totalWords; wi++) {
                const ww = cachedWordsMeta[wi].weight;
                if (acc + ww >= targetW) {
                  mapped = wi + (targetW - acc) / ww;
                  break;
                }
                acc += ww;
              }
              floatWordPos = mapped;
            }
          } else {
            // Deterministic conversational cadence timer (Simulator / silent speaking preview)
            let accT = 0;
            let mapped = totalWords;
            for (let wi = 0; wi < totalWords; wi++) {
              const wordDur = Math.min(0.46, Math.max(0.24, 0.14 + cachedWordsMeta[wi].text.length * 0.038));
              if (accT + wordDur >= localSpeakClock) {
                mapped = wi + (localSpeakClock - accT) / wordDur;
                break;
              }
              accT += wordDur;
            }
            floatWordPos = mapped;
          }
        }

        const activeWordIdx = Math.min(totalWords - 1, Math.floor(floatWordPos));
        const activeWordFrac = floatWordPos >= totalWords ? 1 : Math.max(0, floatWordPos - Math.floor(floatWordPos));

        // Select caption window containing activeWordIdx
        let targetWinIdx = cachedWindows.findIndex(
          (w) => activeWordIdx >= w.startWordIdx && activeWordIdx <= w.endWordIdx
        );
        if (targetWinIdx === -1 && cachedWindows.length > 0) {
          targetWinIdx = cachedWindows.length - 1;
        }
        if (targetWinIdx !== currentWindowIdx) {
          currentWindowIdx = targetWinIdx;
          windowCrossfadeAlpha = 0;
        }
        windowCrossfadeAlpha = Math.min(1, windowCrossfadeAlpha + dt * 7.5);

        const activeWindow = cachedWindows[currentWindowIdx];
        if (activeWindow) {
          const dustRgb = targetPal.dustColor;
          const dr = Math.round(dustRgb[0] * 255);
          const dg = Math.round(dustRgb[1] * 255);
          const db = Math.round(dustRgb[2] * 255);

          ctx.font = fontStr;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';

          for (const word of activeWindow.words) {
            if (word.globalIdx < activeWordIdx || floatWordPos >= totalWords) {
              // 1. Settled crisp typography for already-spoken words
              ctx.fillStyle = `rgba(226, 232, 240, ${(0.88 * windowCrossfadeAlpha).toFixed(3)})`;
              ctx.fillText(word.text, word.x, word.baselineY);
            } else if (word.globalIdx === activeWordIdx) {
              // 2. Active Word: Dust Plume pouring from orb underside -> Swirling -> Sharp Coalescence
              const dxAim = (word.centerX - orbCenterX) / Math.max(1, orbRadiusPx * 1.4);
              targetAimX = Math.max(-1, Math.min(1, dxAim));

              const phase = activeWordFrac;
              const sample = getWordGlyphSample(word.text, fontSize, fontStr);

              // Anchor plume cleanly to bottom contour of 3D orb directly above word
              const emitBaseX =
                orbCenterX +
                Math.max(-orbRadiusPx * 0.36, Math.min(orbRadiusPx * 0.36, (word.centerX - orbCenterX) * 0.28));
              const emitBaseY = orbCenterY + orbRadiusPx * 0.84;

              // Crossfade dust -> razor-sharp glowing word typography over phase 0.56 -> 0.88
              const textFadeIn = Math.max(0, Math.min(1, (phase - 0.56) / 0.3));
              const particleFadeOut = phase > 0.62 ? Math.max(0, 1 - (phase - 0.62) / 0.24) : 1;

              // Draw fine sparkling sand grains coalescing into every pixel of the active word
              if (particleFadeOut > 0.01 && sample.points.length > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';

                for (let pi = 0; pi < sample.points.length; pi++) {
                  const pt = sample.points[pi];
                  const tLocal = Math.max(0, Math.min(1, (phase - pt.delay) / Math.max(0.28, 0.68 - pt.delay)));
                  if (tLocal <= 0) continue;

                  // Immediate downward departure from orb underside (zero border clumping) + smooth glyph lock
                  const yEase = Math.min(1, Math.pow(tLocal, 0.72));
                  const xEase =
                    tLocal < 0.5 ? 2 * tLocal * tLocal : 1 - Math.pow(-2 * tLocal + 2, 2) / 2;
                  const ease = yEase * 0.55 + xEase * 0.45;

                  const spawnX = emitBaseX + (pt.seedA - 0.5) * 20;
                  const spawnY = emitBaseY + 2 + pt.seedB * 6;
                  const targetX = word.x + pt.dx;
                  const targetY = word.baselineY + pt.dy;

                  // Swirl turbulence envelope (zero at emission, curls smoothly mid-flight, locks to 0 on arrival)
                  const swirlEnv = Math.sin(Math.PI * tLocal);
                  const angle = tLocal * 5.6 + pt.seedA * Math.PI * 2 + elapsed * 2.4;
                  const curlX = Math.cos(angle) * 11 * swirlEnv;
                  const curlY = Math.sin(angle * 0.9 + pt.seedB * 4) * 5.5 * swirlEnv;

                  const px = spawnX + (targetX - spawnX) * xEase + curlX;
                  const py = spawnY + (targetY - spawnY) * yEase + curlY;

                  // Shift color from luminous cyan sand -> ice-white pinpoint as letter forms
                  const rC = Math.round(dr + (235 - dr) * ease);
                  const gC = Math.round(dg + (248 - dg) * ease);
                  const bC = Math.round(db + (255 - db) * ease);
                  const ptAlpha = Math.sin(Math.min(1, tLocal * 1.45) * Math.PI * 0.5) * particleFadeOut * 0.88;
                  // Fine micro-grain size matching Three.js 24k sand particles
                  const radius = 0.92 - ease * 0.25 + (1 - ease) * pt.seedB * 0.28;

                  ctx.fillStyle = `rgba(${rC}, ${gC}, ${bC}, ${ptAlpha.toFixed(3)})`;
                  ctx.beginPath();
                  ctx.arc(px, py, Math.max(0.55, radius), 0, Math.PI * 2);
                  ctx.fill();
                }

                // Delicate swirling dust wisps in funnel above the forming word (never covering finished text)
                const wispCount = 42;
                for (let wi = 0; wi < wispCount; wi++) {
                  const seed = hashFloat(word.text, 900 + wi);
                  const seed2 = hashFloat(word.text, 1200 + wi);
                  const wProg = (phase * 1.25 + seed * 0.55) % 0.85;
                  const wEase = wProg * wProg * (3 - 2 * wProg);
                  const sx = emitBaseX + (seed - 0.5) * 26;
                  const sy = emitBaseY - seed2 * 8;
                  const tx = word.centerX + (seed2 - 0.5) * Math.min(word.width * 0.7, 28);
                  const ty = word.baselineY - 12 + (seed - 0.5) * 6;
                  const wCurlX = Math.sin(wProg * 6.8 + seed * 8 + elapsed * 3) * 11 * Math.sin(Math.PI * wProg);
                  const wx = sx + (tx - sx) * wEase + wCurlX;
                  const wy = sy + (ty - sy) * wEase;
                  const wAlpha = Math.sin((wProg / 0.85) * Math.PI) * particleFadeOut * 0.48;
                  ctx.fillStyle = `rgba(${dr}, ${dg}, ${db}, ${wAlpha.toFixed(3)})`;
                  ctx.beginPath();
                  ctx.arc(wx, wy, 0.55 + seed2 * 0.42, 0, Math.PI * 2);
                  ctx.fill();
                }

                ctx.restore();
              }

              // Crisp word text fades in smoothly on exact alignment once particles lock
              if (textFadeIn > 0.01) {
                ctx.save();
                ctx.shadowColor = `rgba(${dr}, ${dg}, ${db}, ${(0.55 * (1 - textFadeIn * 0.7)).toFixed(2)})`;
                ctx.shadowBlur = 7 * (1 - textFadeIn * 0.7);
                ctx.fillStyle = `rgba(240, 249, 255, ${(textFadeIn * 0.96 * windowCrossfadeAlpha).toFixed(3)})`;
                ctx.fillText(word.text, word.x, word.baselineY);
                ctx.restore();
              }
            }
            // Words > activeWordIdx stay hidden until reached sequentially
          }
        }
      } else {
        lastSpeechKey = '';
      }

      curAimX += (targetAimX - curAimX) * Math.min(1, dt * 8);
      uniforms.uAimX.value = curAimX;

      ctx.restore();
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      geometry.dispose();
      material.dispose();
      renderer?.dispose();
    };
  }, []);

  const indicatorMeta = (target: JarvisVisualState) => {
    const isActive = activeState === target;
    const cfg = JARVIS_PALETTE[target];
    return {
      isActive,
      cfg,
      style: isActive
        ? {
            color: cfg.pillTextHex,
            textShadow: `0 0 12px ${cfg.glowHex}`,
          }
        : {
            color: 'rgba(148, 163, 184, 0.48)',
          },
    };
  };

  return (
    <div className={`w-full max-w-[520px] mx-auto flex flex-col items-center select-none relative ${className}`}>
      {/* Clean Borderless State Telemetry (Listening · Thinking · Speaking) */}
      <div className="flex items-center gap-6 z-20 mb-1.5">
        {(['listening', 'thinking', 'speaking'] as const).map((pill) => {
          const { style, isActive, cfg } = indicatorMeta(pill);
          const label = pill.charAt(0).toUpperCase() + pill.slice(1);
          return (
            <button
              key={pill}
              type="button"
              onClick={() => {
                if (isDevOpen) {
                  setDevState(pill);
                  if (pill === 'speaking') setSimRunId((c) => c + 1);
                } else if (onStateChange) {
                  onStateChange(pill);
                }
              }}
              style={{
                ...style,
                fontFamily: 'var(--font-jakarta), "Plus Jakarta Sans", "Inter", system-ui, sans-serif',
              }}
              className="group relative flex flex-col items-center bg-transparent border-0 shadow-none px-1 py-0.5 text-[11px] font-medium tracking-[0.04em] transition-all duration-300 hover:text-slate-200 cursor-pointer"
            >
              <span>{label}</span>
              <span
                className={`mt-1 h-[1.5px] rounded-full transition-all duration-300 ${
                  isActive ? 'w-5 opacity-90' : 'w-0 opacity-0 group-hover:w-3 group-hover:opacity-35'
                }`}
                style={{
                  backgroundColor: isActive ? cfg.pillTextHex : 'currentColor',
                  boxShadow: isActive ? `0 0 8px ${cfg.glowHex}` : 'none',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Synchronized Dual-Canvas Visual Stage: WebGL 3D Orb + HiDPI Word-by-Word Particle Overlay */}
      <div
        ref={stageContainerRef}
        className="relative w-full overflow-hidden flex items-center justify-center"
        style={{ height: `${stageDims.h}px` }}
      >
        <canvas
          ref={webglCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />
      </div>

      {/* Dev Simulator Toggle Footer (hidden unless showDevPanel is enabled) */}
      {showDevPanel && (
        <div className="w-full flex flex-col items-center mt-0.5 z-20">
          <div className="flex items-center gap-3 text-[10px] text-slate-600">
            <button
              type="button"
              onClick={() => setIsDevOpen((v) => !v)}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:text-slate-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Toggle Jarvis Animation Simulator"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Simulator</span>
            </button>
            <span className="font-mono text-[9px] text-slate-600 uppercase tracking-widest">
              24K PARTICLES · {activeState}
            </span>
          </div>

          {isDevOpen && (
            <div className="mt-2.5 w-full max-w-[380px] p-3 rounded-xl bg-slate-900/90 border border-slate-700/60 backdrop-blur-md shadow-2xl space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Jarvis State Simulator
                </span>
                <span className="text-[10px] font-mono text-sky-400">{activeState.toUpperCase()}</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(['idle', 'listening', 'thinking', 'speaking'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setDevState(s);
                      if (s === 'speaking') setSimRunId((c) => c + 1);
                    }}
                    className={`py-1 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      devState === s
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {devState === 'listening' && (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Simulated User Prompt:</label>
                  <input
                    type="text"
                    value={devTranscript}
                    onChange={(e) => setDevTranscript(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              {devState === 'speaking' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-400">Simulated AI Reply (Word-by-Word Dust):</label>
                    <button
                      type="button"
                      onClick={() => setSimRunId((c) => c + 1)}
                      className="text-[10px] font-semibold text-sky-400 hover:text-sky-300"
                    >
                      Replay Dust
                    </button>
                  </div>
                  <input
                    type="text"
                    value={devReply}
                    onChange={(e) => {
                      setDevReply(e.target.value);
                      setSimRunId((c) => c + 1);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
