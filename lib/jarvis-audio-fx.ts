/**
 * J.A.R.V.I.S. Acoustic Synthesizer & Web Audio FX Engine
 * Zero-dependency procedural synthesis of sci-fi UI acoustics:
 * - 432Hz/108Hz harmonic ambient breathing hum
 * - 880Hz/1760Hz dual-crystal success chime
 * - 55Hz low damped error buzz with sub-harmonic
 * - 440Hz -> 880Hz ascending wake sweep
 * - 120Hz -> 40Hz sub-bass "puff" expansion whoosh
 */

class JarvisAudioFxEngine {
  private ctx: AudioContext | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private isHumming = false;

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Confirmation Chime: Dual harmonic bell tone (880Hz + 1760Hz) with 650ms exponential decay
   */
  public playSuccessChime() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760, now); // A6 (octave harmonic)

    gainNode.gain.setValueAtTime(0.25, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.7);
    osc2.stop(now + 0.7);
  }

  /**
   * Error Buzz: Low, dampened 55Hz square wave through 320Hz lowpass filter
   */
  public playErrorBuzz() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(55, now); // Low A1

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);

    gainNode.gain.setValueAtTime(0.28, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Wake Tone: Ascending frequency chirp (440Hz -> 880Hz over 130ms)
   */
  public playWakeTone() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.13);

    gainNode.gain.setValueAtTime(0.18, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Orb "Puff" Expansion Whoosh: Sub-bass resonance (130Hz -> 38Hz)
   */
  public playPuffImpact() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.34);
  }

  /**
   * Harmonic Ambient Drone: 432Hz + 108Hz with 1.5s periodic LFO matching the orb breathing
   */
  public startAmbientHum() {
    if (this.isHumming) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 432Hz Harmonic Sine
      this.ambientOsc1 = ctx.createOscillator();
      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(432, now);

      // 108Hz Sub-harmonic
      this.ambientOsc2 = ctx.createOscillator();
      this.ambientOsc2.type = 'sine';
      this.ambientOsc2.frequency.setValueAtTime(108, now);

      // Main Ambient Gain (very soft, non-intrusive)
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.015, now);

      // 1.5s LFO (0.667 Hz) to modulate volume synchronously with orb pulse
      this.lfo = ctx.createOscillator();
      this.lfo.frequency.setValueAtTime(0.667, now);
      this.lfoGain = ctx.createGain();
      this.lfoGain.gain.setValueAtTime(0.008, now);

      this.lfo.connect(this.lfoGain);
      this.lfoGain.connect(this.ambientGain.gain);

      this.ambientOsc1.connect(this.ambientGain);
      this.ambientOsc2.connect(this.ambientGain);
      this.ambientGain.connect(ctx.destination);

      this.ambientOsc1.start();
      this.ambientOsc2.start();
      this.lfo.start();
      this.isHumming = true;
    } catch {
      // Audio autoplay policy handled silently
    }
  }

  public stopAmbientHum() {
    if (!this.isHumming) return;
    try {
      this.ambientOsc1?.stop();
      this.ambientOsc2?.stop();
      this.lfo?.stop();
      this.ambientOsc1?.disconnect();
      this.ambientOsc2?.disconnect();
      this.ambientGain?.disconnect();
      this.lfo?.disconnect();
      this.lfoGain?.disconnect();
    } catch {}
    this.ambientOsc1 = null;
    this.ambientOsc2 = null;
    this.ambientGain = null;
    this.lfo = null;
    this.lfoGain = null;
    this.isHumming = false;
  }
}

export const jarvisAudioFx = new JarvisAudioFxEngine();
