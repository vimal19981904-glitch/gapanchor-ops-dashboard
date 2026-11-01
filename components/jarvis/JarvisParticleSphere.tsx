'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { JARVIS_PALETTE, StateColorConfig } from '@/lib/jarvis-palette';

export type JarvisVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface JarvisParticleSphereProps {
  state?: JarvisVisualState;
  userTranscript?: string;
  replyText?: string;
  audioLevel?: number;        // 0 to 1 audio reactive volume
  onStateChange?: (state: JarvisVisualState) => void;
  showDevPanel?: boolean;     // Enable dev-only simulation panel
  className?: string;
  size?: number;              // Optional override size in pixels
}

// Vertex shader for Living Particle Sphere with morph targets (Sphere -> 4 Slices -> Twisted Lissajous Ribbon)
const sphereVertexShader = `
  uniform float uTime;
  uniform float uMorphToSlab;
  uniform float uMorphToRibbon;
  uniform float uAudioLevel;
  uniform float uWobbleSpeed;
  uniform vec3 uColorCore;
  uniform vec3 uColorRim;
  uniform vec3 uColorHighlight;

  attribute vec3 aTargetSlab;
  attribute vec3 aTargetRibbon;
  attribute float aSeed;
  attribute float aSize;

  varying vec3 vColor;
  varying float vAlpha;

  // Simple 3D pseudo noise
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,1,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
    );
  }

  void main() {
    // Staggered morphing per particle based on its unique seed
    float staggeredSlab = smoothstep(aSeed * 0.3, 0.7 + aSeed * 0.3, uMorphToSlab);
    float staggeredRibbon = smoothstep(aSeed * 0.3, 0.7 + aSeed * 0.3, uMorphToRibbon);

    // Interpolate positions: Sphere -> 4-slice Slab -> Lissajous Twisted Ribbon
    vec3 p = mix(position, aTargetSlab, staggeredSlab);
    p = mix(p, aTargetRibbon, staggeredRibbon);

    // Living particle sphere organic jiggle & breathing
    float t = uTime * uWobbleSpeed;
    float n1 = noise(p * 0.07 + vec3(t * 0.5, t * 0.3, t * 0.4));
    float n2 = noise(p * 0.14 - vec3(t * 0.4, t * 0.6, t * 0.2));

    // Audio reactive breathing expansion and shell ripples ("jiggling up here and there")
    float wobbleAmp = 1.5 + uAudioLevel * 7.0;
    vec3 norm = normalize(p + vec3(0.0001));
    vec3 displacement = norm * ((n1 - 0.5) * wobbleAmp);
    displacement += vec3(cos(t + aSeed * 6.28), sin(t + aSeed * 6.28), cos(t * 0.7)) * (0.5 + uAudioLevel * 2.0);

    vec3 finalPos = p + displacement;

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Crisp stardust grain point sizing (matte dots, ~1.2px - 2.2px)
    float pointScale = 1.0 + uAudioLevel * 0.35;
    gl_PointSize = (aSize * pointScale * (140.0 / -mvPosition.z));
    gl_PointSize = clamp(gl_PointSize, 1.0, 7.0);

    // Physically accurate view-space Fresnel for hollow sphere shell
    vec3 viewNormal = normalize(normalMatrix * norm);
    float rimFactor = 1.0 - abs(viewNormal.z);
    rimFactor = pow(rimFactor, 1.3);

    // Color gradient: Matte Core -> Shell Rim -> Soft Sky Tint (No blinding white)
    vec3 col = mix(uColorCore, uColorRim, rimFactor);
    if (rimFactor > 0.65) {
      col = mix(col, uColorHighlight, (rimFactor - 0.65) * 1.6);
    }

    // Alpha: front particles are crisp, back hemisphere particles are dimmer for stereoscopic depth
    float baseAlpha = mix(0.40, 0.95, rimFactor);
    if (viewNormal.z < 0.0) {
      baseAlpha *= 0.45; // Depth separation
    }

    vColor = col;
    vAlpha = baseAlpha + uAudioLevel * 0.15;
  }
`;

// Fragment shader for crisp matte stardust particles
const sphereFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Crisp circular stardust grain with smooth anti-aliased edge
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float grain = smoothstep(0.5, 0.38, dist);
    gl_FragColor = vec4(vColor, grain * vAlpha);
  }
`;

// Vertex shader for Text-from-Dust particles
const dustVertexShader = `
  uniform float uTime;
  uniform float uDustProgress; // 0 (at bottom of sphere) to 1 (at word glyph)
  uniform vec3 uDustColor;
  uniform float uActiveWordGlow;

  attribute vec3 aSpawnPos;   // Origin at bottom pole of sphere
  attribute vec3 aGlyphPos;   // Target glyph position
  attribute float aDustSeed;
  attribute float aIsActiveWord; // 1.0 if this particle belongs to the currently active spoken word

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float localProgress = smoothstep(aDustSeed * 0.35, 0.65 + aDustSeed * 0.35, uDustProgress);

    // Curved parabolic descent path with turbulence
    vec3 p = mix(aSpawnPos, aGlyphPos, localProgress);

    // Turbulence while airborne (Frames 51-80 dust cloud)
    float flightMask = sin(localProgress * 3.14159);
    p.x += sin(uTime * 2.8 + aDustSeed * 20.0) * flightMask * 8.0;
    p.y -= sin(localProgress * 1.57) * flightMask * 5.0;
    p.z += cos(uTime * 2.2 + aDustSeed * 15.0) * flightMask * 6.0;

    // Settle with micro-shimmer once formed
    if (localProgress > 0.95) {
      p.x += sin(uTime * 3.5 + aDustSeed * 10.0) * 0.3;
      p.y += cos(uTime * 3.5 + aDustSeed * 10.0) * 0.3;
    }

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Crisp point size matching matte sphere
    float baseSize = mix(2.2, 3.2, aIsActiveWord);
    gl_PointSize = baseSize * (140.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 7.5);

    // Color: Sky blue stardust with soft periwinkle highlight on active word
    vec3 col = uDustColor;
    if (aIsActiveWord > 0.5) {
      col = mix(col, vec3(0.75, 0.9, 1.0), 0.55 + uActiveWordGlow * 0.25);
      vAlpha = 0.95;
    } else {
      vAlpha = mix(0.35, 0.75, localProgress);
    }
    vColor = col;
  }
`;

const dustFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float grain = smoothstep(0.5, 0.38, dist);
    gl_FragColor = vec4(vColor, grain * vAlpha);
  }
`;

/**
 * Samples canvas pixels to generate particle targets for words
 */
function sampleWordGlyphPositions(
  text: string,
  activeWordIndex: number,
  maxParticles = 5000,
  containerWidth = 320
): { positions: Float32Array; activeFlags: Float32Array; count: number } {
  if (typeof window === 'undefined' || !text.trim()) {
    return { positions: new Float32Array(0), activeFlags: new Float32Array(0), count: 0 };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { positions: new Float32Array(0), activeFlags: new Float32Array(0), count: 0 };

  const words = text.trim().split(/\s+/);
  const fontSize = 28;
  const lineHeight = 36;
  const maxWidth = Math.min(containerWidth * 0.85, 280);

  canvas.width = 400;
  canvas.height = 140;

  ctx.font = `600 ${fontSize}px var(--font-jakarta), -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Word wrapping (max 2 lines)
  const lines: { text: string; wordIndices: number[]; y: number }[] = [];
  let currentLineWords: string[] = [];
  let currentLineIndices: number[] = [];

  for (let i = 0; i < words.length; i++) {
    const testLine = [...currentLineWords, words[i]].join(' ');
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLineWords.length > 0 && lines.length === 0) {
      lines.push({
        text: currentLineWords.join(' '),
        wordIndices: [...currentLineIndices],
        y: canvas.height * 0.35,
      });
      currentLineWords = [words[i]];
      currentLineIndices = [i];
    } else {
      currentLineWords.push(words[i]);
      currentLineIndices.push(i);
    }
  }
  if (currentLineWords.length > 0) {
    lines.push({
      text: currentLineWords.join(' '),
      wordIndices: [...currentLineIndices],
      y: lines.length === 0 ? canvas.height * 0.5 : canvas.height * 0.65,
    });
  }

  // Draw lines to offscreen canvas
  ctx.fillStyle = '#ffffff';
  for (const line of lines) {
    ctx.fillText(line.text, canvas.width / 2, line.y);
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const sampledPoints: { x: number; y: number; isActive: boolean }[] = [];

  // Determine active word bounding or rough position
  const step = 2;
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const idx = (y * canvas.width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 130) {
        // Map 2D canvas coordinates to 3D Three.js space below the sphere
        const worldX = (x - canvas.width / 2) * 0.54;
        const worldY = -(y - canvas.height / 2) * 0.54 - 68.0; // Comfortably centered below sphere
        sampledPoints.push({
          x: worldX,
          y: worldY,
          isActive: true,
        });
      }
    }
  }

  const total = Math.min(sampledPoints.length, maxParticles);
  const positions = new Float32Array(total * 3);
  const activeFlags = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    positions[i * 3 + 0] = sampledPoints[i].x;
    positions[i * 3 + 1] = sampledPoints[i].y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6.0;
    activeFlags[i] = sampledPoints[i].isActive ? 1.0 : 0.0;
  }

  return { positions, activeFlags, count: total };
}

export function JarvisParticleSphere({
  state = 'idle',
  userTranscript = '',
  replyText = '',
  audioLevel = 0,
  onStateChange,
  showDevPanel = false,
  className = '',
  size = 180,
}: JarvisParticleSphereProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dev simulation state
  const [devState, setDevState] = useState<JarvisVisualState>(state);
  const [devTranscript, setDevTranscript] = useState("Hey, what's on today?");
  const [devReply, setDevReply] = useState("Good morning. You have three meetings. The first one moved to ten, so you've got time for coffee.");
  const [devMicLevel, setDevMicLevel] = useState(0.25);
  const [isDevOpen, setIsDevOpen] = useState(false);

  // Active state resolving (dev state takes precedence if dev panel open)
  const activeState = isDevOpen ? devState : state;
  const activeUserTranscript = isDevOpen ? devTranscript : userTranscript;
  const activeReplyText = isDevOpen ? devReply : replyText;
  const activeAudioLevel = isDevOpen ? devMicLevel : audioLevel;

  // Visual Palette
  const palette = useMemo(() => {
    return JARVIS_PALETTE[activeState] || JARVIS_PALETTE.idle;
  }, [activeState]);

  // Three.js References
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    sphereMesh: THREE.Points;
    sphereMaterial: THREE.ShaderMaterial;
    dustMesh: THREE.Points;
    dustMaterial: THREE.ShaderMaterial;
    animationFrameId: number;
    targetSlabUniform: number;
    targetRibbonUniform: number;
    currentSlab: number;
    currentRibbon: number;
    dustProgress: number;
    targetDustProgress: number;
  } | null>(null);

  // Initialize Three.js GPU Particle Systems
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = size;
    const height = size + 55; // Generous vertical room for sphere and dust-formed text

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
    camera.position.z = 210;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0); // Transparent canvas
    } catch (e) {
      console.warn('WebGL init error:', e);
      return;
    }

    // Particle Counts: ~26,000 desktop, ~12,000 mobile
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 12000 : 26000;

    // Attributes for Sphere
    const spherePositions = new Float32Array(particleCount * 3);
    const slabPositions = new Float32Array(particleCount * 3);
    const ribbonPositions = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);

    const baseRadius = 56.0;

    // Precompute Hollow Sphere (Fibonacci distribution), 4 Slices/Slabs, and Lissajous Ribbon
    for (let i = 0; i < particleCount; i++) {
      const seed = Math.random();
      seeds[i] = seed;
      // Fine matte stardust grain sizes (0.9 to 1.65)
      sizes[i] = 0.9 + Math.random() * 0.75;

      // 1. Hollow Fibonacci Sphere Shell (tight 2.2px thickness matching ezgif-frame-005.jpg)
      const phi = Math.acos(1 - 2 * ((i + 0.5) / particleCount));
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const shellThickness = (Math.random() - 0.5) * 2.2;
      const r = baseRadius + shellThickness;

      const sx = r * Math.sin(phi) * Math.cos(theta);
      const sy = r * Math.cos(phi);
      const sz = r * Math.sin(phi) * Math.sin(theta);

      spherePositions[i * 3 + 0] = sx;
      spherePositions[i * 3 + 1] = sy;
      spherePositions[i * 3 + 2] = sz;

      // 2. 4-Band Horizontal Slices (Squash Transition for Phase 2)
      // Clamps y into 4 distinct horizontal tiers with horizontal particle flare
      const bandIndex = Math.floor(seed * 4.0); // 0, 1, 2, 3
      const bandY = (bandIndex - 1.5) * 16.0; // [-24, -8, 8, 24]
      const slabRadius = (baseRadius * 1.35) * Math.sqrt(Math.max(0.05, 1.0 - Math.pow(bandY / 50.0, 2.0)));
      const slabAngle = theta + (Math.random() - 0.5) * 0.4;
      const slabSpread = 0.8 + 0.35 * Math.random();

      slabPositions[i * 3 + 0] = slabRadius * Math.cos(slabAngle) * slabSpread;
      slabPositions[i * 3 + 1] = bandY + (Math.random() - 0.5) * 4.0;
      slabPositions[i * 3 + 2] = (sz * 0.4) + (Math.random() - 0.5) * 6.0;

      // 3. Thick 3D Closed Lissajous Ribbon Knot (for Phase 2)
      // x = sin(2t) * R, y = sin(3t) * R * 0.65, z = cos(2t) * R
      const t = (i / particleCount) * Math.PI * 2.0;
      const ribbonR = baseRadius * 1.15;
      const rx = Math.sin(2.0 * t) * ribbonR;
      const ry = Math.sin(3.0 * t) * (ribbonR * 0.58);
      const rz = Math.cos(2.0 * t) * (ribbonR * 0.85);

      // Ribbon width and thickness
      const ribbonWidth = (Math.random() - 0.5) * 12.0;
      const ribbonThickness = (Math.random() - 0.5) * 5.0;

      ribbonPositions[i * 3 + 0] = rx + ribbonWidth * Math.cos(t);
      ribbonPositions[i * 3 + 1] = ry + ribbonThickness;
      ribbonPositions[i * 3 + 2] = rz + ribbonWidth * Math.sin(t);
    }

    const sphereGeometry = new THREE.BufferGeometry();
    sphereGeometry.setAttribute('position', new THREE.BufferAttribute(spherePositions, 3));
    sphereGeometry.setAttribute('aTargetSlab', new THREE.BufferAttribute(slabPositions, 3));
    sphereGeometry.setAttribute('aTargetRibbon', new THREE.BufferAttribute(ribbonPositions, 3));
    sphereGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    sphereGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const sphereMaterial = new THREE.ShaderMaterial({
      vertexShader: sphereVertexShader,
      fragmentShader: sphereFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uMorphToSlab: { value: 0.0 },
        uMorphToRibbon: { value: 0.0 },
        uAudioLevel: { value: 0.0 },
        uWobbleSpeed: { value: 1.2 },
        uColorCore: { value: new THREE.Vector3(...JARVIS_PALETTE.idle.coreColor) },
        uColorRim: { value: new THREE.Vector3(...JARVIS_PALETTE.idle.rimColor) },
        uColorHighlight: { value: new THREE.Vector3(...JARVIS_PALETTE.idle.highlightColor) },
      },
      transparent: true,
      blending: THREE.NormalBlending,
      depthTest: true,
      depthWrite: false,
    });

    const sphereMesh = new THREE.Points(sphereGeometry, sphereMaterial);
    sphereMesh.position.y = 10.0;
    scene.add(sphereMesh);

    // ─── Text-from-Dust System (5,000 Particles) ───
    const dustCount = 4500;
    const dustSpawnPos = new Float32Array(dustCount * 3);
    const dustGlyphPos = new Float32Array(dustCount * 3);
    const dustSeeds = new Float32Array(dustCount);
    const dustActiveFlags = new Float32Array(dustCount);

    // Initial spawn point: bottom pole of the elevated sphere (y = -44)
    for (let i = 0; i < dustCount; i++) {
      dustSpawnPos[i * 3 + 0] = (Math.random() - 0.5) * 18.0;
      dustSpawnPos[i * 3 + 1] = -44.0 - Math.random() * 8.0;
      dustSpawnPos[i * 3 + 2] = (Math.random() - 0.5) * 18.0;

      dustGlyphPos[i * 3 + 0] = dustSpawnPos[i * 3 + 0];
      dustGlyphPos[i * 3 + 1] = dustSpawnPos[i * 3 + 1];
      dustGlyphPos[i * 3 + 2] = dustSpawnPos[i * 3 + 2];

      dustSeeds[i] = Math.random();
      dustActiveFlags[i] = 1.0;
    }

    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustSpawnPos, 3));
    dustGeometry.setAttribute('aSpawnPos', new THREE.BufferAttribute(dustSpawnPos, 3));
    dustGeometry.setAttribute('aGlyphPos', new THREE.BufferAttribute(dustGlyphPos, 3));
    dustGeometry.setAttribute('aDustSeed', new THREE.BufferAttribute(dustSeeds, 1));
    dustGeometry.setAttribute('aIsActiveWord', new THREE.BufferAttribute(dustActiveFlags, 1));

    const dustMaterial = new THREE.ShaderMaterial({
      vertexShader: dustVertexShader,
      fragmentShader: dustFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uDustProgress: { value: 0.0 },
        uDustColor: { value: new THREE.Vector3(...JARVIS_PALETTE.idle.dustColor) },
        uActiveWordGlow: { value: 0.0 },
      },
      transparent: true,
      blending: THREE.NormalBlending,
      depthTest: true,
      depthWrite: false,
    });

    const dustMesh = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustMesh);

    threeRef.current = {
      scene,
      camera,
      renderer,
      sphereMesh,
      sphereMaterial,
      dustMesh,
      dustMaterial,
      animationFrameId: 0,
      targetSlabUniform: 0.0,
      targetRibbonUniform: 0.0,
      currentSlab: 0.0,
      currentRibbon: 0.0,
      dustProgress: 0.0,
      targetDustProgress: 0.0,
    };

    // Render Loop
    let clock = new THREE.Clock();

    const animate = () => {
      if (!threeRef.current) return;
      const t = clock.getElapsedTime();

      // Smooth state tweening (600-850ms ease)
      const data = threeRef.current;
      data.currentSlab += (data.targetSlabUniform - data.currentSlab) * 0.085;
      data.currentRibbon += (data.targetRibbonUniform - data.currentRibbon) * 0.075;
      data.dustProgress += (data.targetDustProgress - data.dustProgress) * 0.065;

      data.sphereMaterial.uniforms.uTime.value = t;
      data.sphereMaterial.uniforms.uMorphToSlab.value = data.currentSlab;
      data.sphereMaterial.uniforms.uMorphToRibbon.value = data.currentRibbon;

      data.dustMaterial.uniforms.uTime.value = t;
      data.dustMaterial.uniforms.uDustProgress.value = data.dustProgress;

      // Rotate sphere slowly (faster when thinking ribbon)
      const rotSpeed = data.currentRibbon > 0.5 ? 0.016 : 0.007;
      data.sphereMesh.rotation.y += rotSpeed;
      data.sphereMesh.rotation.x = Math.sin(t * 0.5) * 0.12;

      data.renderer.render(data.scene, data.camera);
      data.animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.animationFrameId);
        try {
          threeRef.current.renderer.dispose();
          threeRef.current.sphereMesh.geometry.dispose();
          threeRef.current.sphereMaterial.dispose();
          threeRef.current.dustMesh.geometry.dispose();
          threeRef.current.dustMaterial.dispose();
        } catch {}
        threeRef.current = null;
      }
    };
  }, [size]);

  // Handle State Transitions (Morph targets & Shaders)
  useEffect(() => {
    if (!threeRef.current) return;

    const { sphereMaterial, dustMaterial } = threeRef.current;
    const targetColors = JARVIS_PALETTE[activeState] || JARVIS_PALETTE.idle;

    // Color updates
    sphereMaterial.uniforms.uColorCore.value.set(...targetColors.coreColor);
    sphereMaterial.uniforms.uColorRim.value.set(...targetColors.rimColor);
    sphereMaterial.uniforms.uColorHighlight.value.set(...targetColors.highlightColor);
    dustMaterial.uniforms.uDustColor.value.set(...targetColors.dustColor);

    if (activeState === 'listening') {
      // Living Particle Sphere with organic breath
      threeRef.current.targetSlabUniform = 0.0;
      threeRef.current.targetRibbonUniform = 0.0;
      threeRef.current.targetDustProgress = 0.0;
      if (threeRef.current.dustMesh) threeRef.current.dustMesh.visible = false;
      sphereMaterial.uniforms.uWobbleSpeed.value = 1.25;
    } else if (activeState === 'thinking') {
      // Step 1: Squash into 4 horizontal slabs (Frames 31-34, ~420ms)
      threeRef.current.targetSlabUniform = 1.0;
      threeRef.current.targetRibbonUniform = 0.0;
      threeRef.current.targetDustProgress = 0.0;
      if (threeRef.current.dustMesh) threeRef.current.dustMesh.visible = false;
      sphereMaterial.uniforms.uWobbleSpeed.value = 1.6;

      // Step 2: Unfurl into 3D twisted Lissajous ribbon knot (Frames 35-47)
      const ribbonTimer = setTimeout(() => {
        if (threeRef.current) {
          threeRef.current.targetRibbonUniform = 1.0;
          threeRef.current.sphereMaterial.uniforms.uWobbleSpeed.value = 2.1;
        }
      }, 420);

      return () => clearTimeout(ribbonTimer);
    } else if (activeState === 'speaking') {
      // Step 1: Collapse ribbon back into dense stardust sphere (Frames 48-50)
      threeRef.current.targetRibbonUniform = 0.0;
      threeRef.current.targetSlabUniform = 0.0;
      if (threeRef.current.dustMesh) threeRef.current.dustMesh.visible = true;
      threeRef.current.targetDustProgress = 1.0;
      sphereMaterial.uniforms.uWobbleSpeed.value = 1.8;
    } else {
      // Idle relaxed sphere
      threeRef.current.targetSlabUniform = 0.0;
      threeRef.current.targetRibbonUniform = 0.0;
      threeRef.current.targetDustProgress = 0.0;
      if (threeRef.current.dustMesh) threeRef.current.dustMesh.visible = false;
      sphereMaterial.uniforms.uWobbleSpeed.value = 0.75;
    }
  }, [activeState, activeUserTranscript]);

  // Audio level updates
  useEffect(() => {
    if (!threeRef.current) return;
    const smoothedLevel = Math.max(0.05, Math.min(activeAudioLevel, 1.0));
    threeRef.current.sphereMaterial.uniforms.uAudioLevel.value = smoothedLevel;
    threeRef.current.dustMaterial.uniforms.uActiveWordGlow.value = smoothedLevel;
  }, [activeAudioLevel]);

  // Text-from-dust glyph target generation
  useEffect(() => {
    if (!threeRef.current) return;

    const displayText = activeState === 'speaking' ? activeReplyText : activeUserTranscript;
    if (!displayText) {
      threeRef.current.targetDustProgress = 0.0;
      return;
    }

    const { positions, activeFlags, count } = sampleWordGlyphPositions(
      displayText,
      -1,
      4500,
      size
    );

    if (count > 0) {
      const glyphAttr = threeRef.current.dustMesh.geometry.getAttribute('aGlyphPos') as THREE.BufferAttribute;
      const flagsAttr = threeRef.current.dustMesh.geometry.getAttribute('aIsActiveWord') as THREE.BufferAttribute;

      if (glyphAttr && flagsAttr) {
        for (let i = 0; i < count; i++) {
          glyphAttr.setXYZ(i, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
          flagsAttr.setX(i, activeFlags[i]);
        }
        glyphAttr.needsUpdate = true;
        flagsAttr.needsUpdate = true;
      }
      threeRef.current.targetDustProgress = 1.0;
    }
  }, [activeState, activeReplyText, activeUserTranscript, size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: `${size}px` }}
    >
      {/* ─── 1. THREE-PILL STATE INDICATOR ─── */}
      <div className="flex items-center justify-center gap-1.5 mb-1.5 z-10">
        {(['listening', 'thinking', 'speaking'] as const).map((pillState) => {
          const isActive = activeState === pillState;
          const config = JARVIS_PALETTE[pillState];
          return (
            <div
              key={pillState}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono tracking-widest uppercase transition-all duration-300 border ${
                isActive
                  ? 'font-bold'
                  : 'text-slate-600 border-transparent bg-transparent opacity-40'
              }`}
              style={{
                borderColor: isActive ? config.pillBorderHex : 'transparent',
                color: isActive ? config.pillTextHex : undefined,
                boxShadow: isActive ? `0 0 8px ${config.glowHex}` : undefined,
                backgroundColor: isActive ? 'rgba(8, 12, 20, 0.85)' : 'transparent',
              }}
            >
              {pillState}
            </div>
          );
        })}
      </div>

      {/* ─── 2. WEBGL PARTICLE SPHERE CANVAS (Clean matte, zero blur smear) ─── */}
      <div
        className="relative flex items-center justify-center pointer-events-auto"
        style={{ width: `${size}px`, height: `${size + 55}px` }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>

      {/* ─── 3. SPOKEN WORDS TRANSCRIPT / STATUS DISPLAY (Phase 1 Listening Mode) ─── */}
      <div className="w-full flex items-center justify-center min-h-[32px] px-2 text-center transition-all duration-300">
        {activeState === 'listening' ? (
          activeUserTranscript ? (
            <p className="text-[12px] font-medium leading-snug tracking-wide text-slate-300">
              {(() => {
                const words = activeUserTranscript.trim().split(/\s+/);
                const lastIdx = words.length - 1;
                return words.map((w, idx) => (
                  <span
                    key={idx}
                    className={
                      idx === lastIdx
                        ? 'text-sky-300 font-bold drop-shadow-[0_0_6px_rgba(56,189,248,0.4)]'
                        : 'text-slate-400 mr-1'
                    }
                  >
                    {w}{idx < lastIdx ? ' ' : ''}
                  </span>
                ));
              })()}
            </p>
          ) : (
            <p className="text-[10px] text-slate-500 italic tracking-wider flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping inline-block" />
              Listening… Speak anytime
            </p>
          )
        ) : activeState === 'idle' ? (
          <p className="text-[10px] text-slate-500 font-mono tracking-wider">
            Say &ldquo;Hey Jarvis&rdquo; or click to talk
          </p>
        ) : activeState === 'thinking' ? (
          <p className="text-[10px] text-indigo-400 font-mono tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Analyzing CRM data…
          </p>
        ) : null}
      </div>

      {/* ─── 4. DEV SIMULATION TRIGGER & PANEL ─── */}
      <div className="mt-1 flex items-center justify-between w-full px-1">
        <button
          type="button"
          onClick={() => setIsDevOpen(!isDevOpen)}
          className="text-[9px] font-mono text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
          title="Toggle Jarvis Particle Dev Simulator"
        >
          {isDevOpen ? '▲ Hide Visual Debug' : '⚙ Simulator'}
        </button>
        <span className="text-[9px] font-mono text-slate-600 uppercase">
          GPU Particles: 26k
        </span>
      </div>

      {isDevOpen && (
        <div className="absolute top-full mt-2 w-72 p-3 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl z-50 animate-[fadeIn_0.15s_ease] text-left">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              Jarvis Visual Simulator
            </span>
            <span className="text-[9px] text-slate-400 font-mono">Dev Tool</span>
          </div>

          {/* State Buttons */}
          <div className="grid grid-cols-4 gap-1 mb-2.5">
            {(['idle', 'listening', 'thinking', 'speaking'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDevState(s)}
                className={`px-1.5 py-1 rounded text-[9px] font-bold uppercase cursor-pointer transition-colors ${
                  devState === s
                    ? 'bg-cyan-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Mic Level Slider */}
          <div className="mb-2">
            <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-0.5">
              <span>Wobble Amplitude</span>
              <span>{Math.round(devMicLevel * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={devMicLevel}
              onChange={(e) => setDevMicLevel(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Transcript simulation input */}
          <div className="mb-2">
            <label className="text-[9px] text-slate-400 font-mono block mb-0.5">User Words:</label>
            <input
              type="text"
              value={devTranscript}
              onChange={(e) => setDevTranscript(e.target.value)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Reply text simulation input */}
          <div>
            <label className="text-[9px] text-slate-400 font-mono block mb-0.5">Reply Text:</label>
            <textarea
              rows={2}
              value={devReply}
              onChange={(e) => setDevReply(e.target.value)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] text-white focus:outline-none focus:border-cyan-400 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
