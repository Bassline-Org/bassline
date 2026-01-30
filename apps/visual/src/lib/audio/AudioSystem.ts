/**
 * AudioSystem - Ambient chord-focused generative audio
 *
 * Philosophy: Spacey, ethereal soundscape focused on layered chord textures.
 * Extended jazz harmonies (Em9, Am9, D7, Cmaj7) with no drums or prominent melody.
 * Lots of reverb/modulation for ambient, meditative atmosphere.
 */

import * as Tone from 'tone'
import {
  createLoFiChain,
  createShimmerChain,
  type LoFiChain,
  type ShimmerChain,
} from './effects'
import {
  createLoFiKeysVoice,
  createWarmPadVoice,
  createSubBassVoice,
  createArpVoice,
  createTapeHissVoice,
  createAwakeningVoices,
  createGlassPadVoice,
  createShimmerPadVoice,
  createBreathDroneVoice,
  type Voice,
  type BreathVoice,
  type BreathDroneVoice,
  type AwakeningVoices,
} from './voices'
import {
  createBalatroLoops,
  startLoopsStaggered,
  disposeLoops,
  TIMING,
  type GenerativeLoop,
} from './loops'
import { E_MINOR, randomNote } from './scales'

export interface PresenceInput {
  velocity: number
  idleMs: number
  focused: boolean
}

export interface AudioAnalysis {
  bass: number   // 0-1, low frequency energy (0-150Hz)
  mid: number    // 0-1, mid frequency energy (150-2000Hz)
  high: number   // 0-1, high frequency energy (2000Hz+)
  overall: number // 0-1, overall audio activity
}

export class AudioSystem {
  private initialized = false
  hasAwakened = false

  // Master output (decibels mode for proper ramping)
  private master!: Tone.Gain<'decibels'>

  // Effect chains
  private lofiChain!: LoFiChain
  private shimmerChain!: ShimmerChain

  // Voices - Ambient style (no drums, no lead melody)
  private lofiKeys!: Voice        // Slow FM pad (transformed from rhythmic stabs)
  private warmPad!: Voice         // Main harmonic bed
  private subBass!: Voice         // Deep sine foundation
  private arp!: Voice             // Very sparse melodic fragments
  private glassPad!: Voice        // High register ethereal sine
  private shimmerPad!: Voice      // Pitch-shifted reverb texture
  private breathDrone!: BreathDroneVoice  // Slowly evolving filtered noise
  private tapeHiss!: BreathVoice
  private awakening!: AwakeningVoices

  // LFO for continuous modulation
  private filterLFO: Tone.LFO | null = null

  // Generative loops
  private loops: GenerativeLoop[] = []

  // FFT analyser for visual feedback (32 bins for efficiency)
  private analyser!: Tone.FFT

  // Smoothed modulation state
  private lfoRate = { current: 0.03, target: 0.03 }

  // Shimmer throttling
  private lastShimmerTime = 0
  private shimmerCooldown = 600 // ms between shimmers

  async initialize(): Promise<void> {
    if (this.initialized) return

    await Tone.start()

    // Master gain - start at very low value
    this.master = new Tone.Gain(-60, 'decibels').toDestination()

    // FFT analyser for visual feedback
    this.analyser = new Tone.FFT(32)
    this.master.connect(this.analyser)

    // Effect chains (no drum chain needed for ambient)
    this.lofiChain = createLoFiChain()
    this.shimmerChain = createShimmerChain()

    this.lofiChain.output.connect(this.master)
    this.shimmerChain.output.connect(this.master)

    // Voices → effect chains
    // Main pad voices through lo-fi chain for warmth
    this.lofiKeys = createLoFiKeysVoice(this.lofiChain.input)
    this.warmPad = createWarmPadVoice(this.lofiChain.input)
    this.subBass = createSubBassVoice(this.lofiChain.input)

    // Arp through shimmer chain for sparse sparkle
    this.arp = createArpVoice(this.shimmerChain.input)

    // New ambient voices
    // Glass pad through shimmer chain for high ethereal tones
    this.glassPad = createGlassPadVoice(this.shimmerChain.input)

    // Shimmer pad through shimmer chain (has internal reverb + pitch shift)
    this.shimmerPad = createShimmerPadVoice(this.shimmerChain.input)

    // Breath drone through lofi chain for subtle wind texture
    this.breathDrone = createBreathDroneVoice(this.lofiChain.input)

    // Tape hiss directly to master (already lo-fi)
    this.tapeHiss = createTapeHissVoice(this.master)

    // Awakening voices through lofi chain
    this.awakening = createAwakeningVoices(this.lofiChain.input)

    // Wait for reverbs to generate impulse responses
    await Promise.all([
      this.lofiChain.ready,
      this.shimmerChain.ready,
    ])

    this.initialized = true
  }

  /**
   * Awaken - system acknowledges first presence
   * Ambient intro sequence (4-6 seconds)
   *
   * Phase 1 (0-2s): Sub rumble fades in, filter starts closed
   * Phase 2 (1-3s): Shimmer arpeggio (E5, G5, B5, E6) staggered
   * Phase 3 (0-4s): Filter sweep 200Hz → 600Hz
   * Phase 4 (2-4s): Rising motif (E4→G4→A4→B4) - hope within minor
   * Phase 5 (4s+):  Crossfade into ambient generative loops
   */
  awaken(): void {
    if (this.hasAwakened || !this.initialized) return

    this.hasAwakened = true

    // Set BPM for 7/4 feel
    Tone.Transport.bpm.value = TIMING.bpm

    // Start very quiet, will ramp up through sequence
    // Phase 1: -60dB → -20dB (2s)
    // Phase 2: -20dB → -6dB (2s)
    // Phase 3: -6dB → -3dB (2s)
    this.master.gain.value = -60
    this.master.gain.linearRampTo(-20, 2)

    // Set initial filter very low - will sweep up
    this.lofiChain.filter.frequency.value = 200

    // Phase 3: Filter sweep 200Hz → 600Hz over 4 seconds
    this.lofiChain.filter.frequency.linearRampTo(600, 4)

    // Create and start filter LFO for breathing movement (kicks in after sweep)
    this.filterLFO = new Tone.LFO({
      frequency: 0.04,  // Very slow breathing
      min: 400,
      max: 900,
      type: 'sine',
    })
    // Delay LFO start until after filter sweep
    setTimeout(() => {
      if (this.filterLFO) {
        this.filterLFO.connect(this.lofiChain.filter.frequency)
        this.filterLFO.start()
      }
    }, 4000)

    // Start transport
    Tone.Transport.start()

    // Start tape hiss quietly, will build
    this.tapeHiss.start()
    this.tapeHiss.setIntensity(0.2)

    // Start breath drone quietly (new ambient voice)
    this.breathDrone.start()
    this.breathDrone.setIntensity(0.2)

    // Phase 1 (0-2s): Sub rumble - deep E1 sine fading in
    this.awakening.sub.triggerAttackRelease('E1', 4, '+0', 0.6)

    // Phase 2 (1-3s): Shimmer arpeggio - staggered high notes
    const shimmerNotes = ['E5', 'G5', 'B5', 'E6']
    shimmerNotes.forEach((note, i) => {
      this.awakening.shimmer.triggerAttackRelease(note, '2n', `+${1 + i * 0.4}`, 0.2)
    })

    // Continue master fade: -20dB → -6dB at 2s mark
    setTimeout(() => {
      this.master.gain.linearRampTo(-6, 2)
      this.tapeHiss.setIntensity(0.4)
      this.breathDrone.setIntensity(0.35)
    }, 2000)

    // Phase 4 (2-4s): Rising motif - E4→G4→A4→B4 (hope within E minor)
    const motifNotes = ['E4', 'G4', 'A4', 'B4']
    motifNotes.forEach((note, i) => {
      this.awakening.motif.triggerAttackRelease(note, '4n', `+${2 + i * 0.5}`, 0.3)
    })

    // Final master fade: -6dB → -3dB at 4s mark
    setTimeout(() => {
      this.master.gain.linearRampTo(-3, 2)
      this.tapeHiss.setIntensity(0.5)
      this.breathDrone.setIntensity(0.5)
    }, 4000)

    // Phase 5 (4s+): Start generative loops - crossfade into ambient audio
    setTimeout(() => {
      this.startGenerativeLayer()
    }, 4000)
  }

  private startGenerativeLayer(): void {
    // Create ambient loops - no drums, no lead melody
    this.loops = createBalatroLoops({
      pad: this.warmPad,
      keys: this.lofiKeys,
      sub: this.subBass,
      arp: this.arp,
      // New ambient voices
      glassPad: this.glassPad,
      shimmer: this.shimmerPad,
      breathDrone: this.breathDrone,
    })

    startLoopsStaggered(this.loops, 0)
  }

  /**
   * Update - continuous modulation from presence state
   */
  update(presence: PresenceInput): void {
    if (!this.initialized || !this.hasAwakened) return

    // Activity level (0-1) from velocity
    const activity = Math.min(1, presence.velocity / 400)

    // Idle level (0-1) from idle time
    const idle = Math.min(1, presence.idleMs / 5000)

    // Modulate filter LFO: more active = wider sweep, higher center
    if (this.filterLFO) {
      const baseMin = 400 + activity * 300 - idle * 150
      const baseMax = 900 + activity * 600 - idle * 200
      this.filterLFO.min = Math.max(200, baseMin)
      this.filterLFO.max = Math.max(this.filterLFO.min + 200, baseMax)
    }

    // Modulate LFO rate: more active = faster breathing
    this.lfoRate.target = 0.03 + activity * 0.1
    this.lfoRate.current += (this.lfoRate.target - this.lfoRate.current) * 0.05
    if (this.filterLFO) {
      this.filterLFO.frequency.value = this.lfoRate.current
    }

    // Tape hiss intensity - emerges with activity, fades with idle
    const hissIntensity = 0.4 + activity * 0.3 - idle * 0.2
    this.tapeHiss.setIntensity(Math.max(0.2, Math.min(1, hissIntensity)))

    // Modulate lo-fi chain based on activity
    // More activity = slightly brighter warmth filter (opens up)
    this.lofiChain.warmth.frequency.rampTo(3000 + activity * 1500, 0.5)

    // Modulate tape wobble: idle = more wobble (dreamy), active = less
    this.lofiChain.tapeWobble.depth.rampTo(0.01 + idle * 0.01, 0.5)

    // Modulate chorus: more activity = thicker
    this.lofiChain.chorus.wet.rampTo(0.25 + activity * 0.2, 0.5)

    // Modulate reverb: idle = wetter (more spacious)
    this.lofiChain.reverb.wet.rampTo(0.3 + idle * 0.15, 1)
    this.shimmerChain.reverb.wet.rampTo(0.4 + idle * 0.15, 1)

    // Modulate shimmer chain phaser: activity = faster sweeps
    this.shimmerChain.phaser.frequency.rampTo(0.1 + activity * 0.15, 0.5)

    // Sparse melodic accent on high activity
    const now = performance.now()
    if (
      activity > 0.6 &&
      now - this.lastShimmerTime > this.shimmerCooldown &&
      Math.random() < 0.08
    ) {
      this.lastShimmerTime = now
      this.triggerAccent(activity)
    }

    // Focus handling
    const targetDb = presence.focused ? -3 : -20
    const currentDb = this.master.gain.value
    if (Math.abs(currentDb - targetDb) > 1) {
      this.master.gain.linearRampTo(targetDb, 1)
    }
  }

  private triggerAccent(intensity: number): void {
    const note = randomNote(E_MINOR.arp)
    this.arp.play(note, '8n', 0.1 + intensity * 0.15)
  }

  /**
   * Get audio analysis for visual feedback
   */
  getAnalysis(): AudioAnalysis {
    if (!this.initialized || !this.analyser) {
      return { bass: 0, mid: 0, high: 0, overall: 0 }
    }

    const values = this.analyser.getValue() as Float32Array

    // Convert dB values to linear (0-1 range)
    const toLinear = (db: number) => {
      const clamped = Math.max(-80, Math.min(0, db))
      return (clamped + 80) / 80
    }

    // Bass: bins 0-1
    const bassSum = toLinear(values[0]) + toLinear(values[1])
    const bass = bassSum / 2

    // Mid: bins 2-5
    const midSum =
      toLinear(values[2]) +
      toLinear(values[3]) +
      toLinear(values[4]) +
      toLinear(values[5])
    const mid = midSum / 4

    // High: bins 6-15
    let highSum = 0
    for (let i = 6; i < 16; i++) {
      highSum += toLinear(values[i])
    }
    const high = highSum / 10

    // Overall activity (weighted average)
    const overall = bass * 0.4 + mid * 0.35 + high * 0.25

    return { bass, mid, high, overall }
  }

  dispose(): void {
    disposeLoops(this.loops)
    Tone.Transport.stop()
    Tone.Transport.cancel()

    // Dispose ambient voices
    this.lofiKeys?.dispose()
    this.warmPad?.dispose()
    this.subBass?.dispose()
    this.arp?.dispose()
    this.glassPad?.dispose()
    this.shimmerPad?.dispose()
    this.breathDrone?.dispose()
    this.tapeHiss?.dispose()
    this.awakening?.dispose()
    this.filterLFO?.dispose()
    this.analyser?.dispose()
    // Dispose effect chains
    this.lofiChain?.dispose()
    this.shimmerChain?.dispose()
    this.master?.dispose()
  }
}
