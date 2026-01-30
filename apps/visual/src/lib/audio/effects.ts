/**
 * Audio effects chains - compositional building blocks
 *
 * Effects shape perception:
 * - Filter frequency = presence/distance (open = close, closed = far)
 * - Reverb wet = intimacy (dry = intimate, wet = expansive)
 * - Chorus = organic thickness
 * - Tape wobble = vintage warmth
 * - Bitcrusher = lo-fi character
 */

import * as Tone from 'tone'

export interface EffectsChain {
  input: Tone.ToneAudioNode
  output: Tone.ToneAudioNode
  filter: Tone.Filter
  ready: Promise<void>
  dispose: () => void
}

export interface LoFiChain extends EffectsChain {
  tapeWobble: Tone.Vibrato
  warmth: Tone.Filter
  saturation: Tone.Distortion
  bitcrusher: Tone.BitCrusher
  chorus: Tone.Chorus
  reverb: Tone.Reverb
}

export interface ShimmerChain extends EffectsChain {
  pingPong: Tone.PingPongDelay
  phaser: Tone.Phaser
  reverb: Tone.Reverb
}

/**
 * Create a lo-fi effects chain with tape-warped warmth
 * Chain: input → filter → tapeWobble → saturation → bitcrusher → chorus → warmth → reverb
 *
 * Ambient processing:
 * - Tape wobble: slow pitch drift for vintage feel
 * - Saturation: soft analog warmth
 * - Bitcrusher: subtle bit reduction for lo-fi character
 * - Warmth filter: high-frequency rolloff
 * - Reverb: longer decay for spacey ambient feel
 */
export function createLoFiChain(): LoFiChain {
  // Reverb - increased for ambient feel
  const reverb = new Tone.Reverb({
    decay: 8,             // Longer decay (was 5)
    wet: 0.45,            // Wetter (was 0.35)
    preDelay: 0.1,        // Slightly longer pre-delay
  })

  // Warmth filter: gentle high-frequency rolloff for "vintage" sound
  const warmth = new Tone.Filter({
    frequency: 3500,
    type: 'lowpass',
    rolloff: -12,
  })

  // Chorus adds organic detuned thickness
  const chorus = new Tone.Chorus({
    frequency: 0.3,      // Slow modulation
    delayTime: 4,        // ms
    depth: 0.5,
    spread: 180,         // Full stereo
    wet: 0.35,
  })

  // Bitcrusher: subtle reduction for lo-fi character
  // 12 bits is subtle (16 is CD quality, 8 is very crunchy)
  const bitcrusher = new Tone.BitCrusher({
    bits: 12,
  })
  // Wrap in a gain node for wet/dry control since BitCrusher doesn't have it
  const bitcrusherGain = new Tone.Gain(0.2)  // 20% crushed, 80% clean parallel

  // Soft saturation: tape-like compression and warmth
  const saturation = new Tone.Distortion({
    distortion: 0.12,
    wet: 0.25,
  })

  // Tape wobble: very slow, subtle pitch variation
  const tapeWobble = new Tone.Vibrato({
    frequency: 0.4,      // Slow wobble
    depth: 0.015,        // Very subtle (~1.5 cents)
    wet: 0.5,
  })

  // Input filter - controls overall brightness
  const filter = new Tone.Filter({
    frequency: 600,
    type: 'lowpass',
    rolloff: -24,
  })

  // Main chain: filter → tapeWobble → saturation → chorus → warmth → reverb
  filter.connect(tapeWobble)
  tapeWobble.connect(saturation)

  // Parallel bitcrusher path for subtle crunch
  saturation.connect(bitcrusher)
  bitcrusher.connect(bitcrusherGain)
  bitcrusherGain.connect(chorus)

  // Main path continues
  saturation.connect(chorus)

  chorus.connect(warmth)
  warmth.connect(reverb)

  // Start the LFO-based effects
  chorus.start()

  const ready = reverb.ready

  return {
    input: filter,
    output: reverb,
    filter,
    tapeWobble,
    saturation,
    bitcrusher,
    chorus,
    warmth,
    reverb,
    ready,
    dispose: () => {
      filter.dispose()
      tapeWobble.dispose()
      saturation.dispose()
      bitcrusher.dispose()
      bitcrusherGain.dispose()
      chorus.dispose()
      warmth.dispose()
      reverb.dispose()
    },
  }
}

/**
 * Create a shimmer chain with stereo width and evolving texture
 * Chain: filter → phaser → pingPong → reverb
 *
 * Ambient shimmer:
 * - PingPongDelay creates stereo bouncing for width
 * - Phaser adds slow evolving sweeps
 * - Very long reverb tail for ethereal sparkle
 */
export function createShimmerChain(): ShimmerChain {
  const reverb = new Tone.Reverb({
    decay: 10,            // Very long decay (was 4)
    wet: 0.6,             // Mostly wet (was 0.45)
  })

  // PingPongDelay for stereo width and interest
  const pingPong = new Tone.PingPongDelay({
    delayTime: 0.25,
    feedback: 0.3,
    wet: 0.35,
  })

  // Phaser for slow evolving sweeps
  const phaser = new Tone.Phaser({
    frequency: 0.12,
    octaves: 3,
    baseFrequency: 800,
    wet: 0.35,
  })

  const filter = new Tone.Filter({
    frequency: 1800,
    type: 'highpass',
    rolloff: -12,
  })

  // Chain: filter → phaser → pingPong → reverb
  filter.connect(phaser)
  phaser.connect(pingPong)
  pingPong.connect(reverb)

  const ready = reverb.ready

  return {
    input: filter,
    output: reverb,
    filter,
    phaser,
    pingPong,
    reverb,
    ready,
    dispose: () => {
      filter.dispose()
      phaser.dispose()
      pingPong.dispose()
      reverb.dispose()
    },
  }
}

/**
 * Drum chain - preserves high frequencies for hi-hats
 * Chain: saturation → compressor → gentle lowpass (8kHz) → short reverb
 * Separate hi-hat bus with highpass for presence
 */
export interface DrumChain extends EffectsChain {
  saturation: Tone.Distortion
  compressor: Tone.Compressor
  hihatBus: Tone.ToneAudioNode  // Separate input for hi-hats
  reverb: Tone.Reverb
}

export function createDrumChain(): DrumChain {
  // Short, tight reverb for drums
  const reverb = new Tone.Reverb({
    decay: 0.8,
    wet: 0.2,
    preDelay: 0.01,
  })

  // Gentle lowpass - preserves hi-hat frequencies unlike lofi chain's 600Hz
  const filter = new Tone.Filter({
    frequency: 8000,
    type: 'lowpass',
    rolloff: -12,
  })

  // Compression for punch
  const compressor = new Tone.Compressor({
    threshold: -20,
    ratio: 4,
    attack: 0.003,
    release: 0.1,
  })

  // Soft saturation for warmth
  const saturation = new Tone.Distortion({
    distortion: 0.08,
    wet: 0.2,
  })

  // Hi-hat bus with highpass to cut mud and add presence
  const hihatFilter = new Tone.Filter({
    frequency: 4000,
    type: 'highpass',
    rolloff: -12,
  })

  // Hi-hat gain for separate level control
  const hihatGain = new Tone.Gain(1.2)  // Slightly boosted

  // Main drum chain: saturation → compressor → filter → reverb
  saturation.connect(compressor)
  compressor.connect(filter)
  filter.connect(reverb)

  // Hi-hat bus: hihatFilter → hihatGain → compressor (joins main chain)
  hihatFilter.connect(hihatGain)
  hihatGain.connect(compressor)

  const ready = reverb.ready

  return {
    input: saturation,
    output: reverb,
    filter,
    saturation,
    compressor,
    hihatBus: hihatFilter,
    reverb,
    ready,
    dispose: () => {
      saturation.dispose()
      compressor.dispose()
      filter.dispose()
      hihatFilter.dispose()
      hihatGain.dispose()
      reverb.dispose()
    },
  }
}

// Legacy export for backwards compatibility
export type AmbientChain = LoFiChain
export const createAmbientChain = createLoFiChain
