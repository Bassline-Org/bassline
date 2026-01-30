/**
 * Audio voices - Ambient chord-focused synth configurations
 *
 * Voices:
 * - Lo-Fi Keys: Slow FM pad (transformed from rhythmic stabs)
 * - Warm Pad: Sustained harmony bed with deep chorus
 * - Sub Bass: Deep sine foundation
 * - Arp: Sparse plucky fragments
 * - Tape Hiss: Constant ambient texture
 * - Glass Pad: High register ethereal sine pad
 * - Shimmer Pad: Pitch-shifted reverb texture
 * - Breath Drone: Slowly evolving filtered noise
 */

import * as Tone from 'tone'

export interface Voice {
  synth: Tone.PolySynth
  play: (note: string, duration: string, velocity?: number, time?: number) => void
  playChord?: (notes: string[], duration: string, velocity?: number, time?: number) => void
  dispose: () => void
}

/**
 * Lo-Fi Keys Pad (transformed from rhythmic stabs)
 * FM synthesis with slow envelope for ambient pad texture
 * Creates second pad layer with FM warmth vs sawtooth of warm pad
 */
export function createLoFiKeysVoice(output: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,      // Slightly detuned for character
    modulationIndex: 1.5,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 2,            // Slow swell in (was 0.01)
      decay: 2,             // Longer decay
      sustain: 0.6,         // Higher sustain for pad
      release: 4,           // Long fade out (was 2)
    },
    modulation: { type: 'triangle' },
    modulationEnvelope: {
      attack: 1,            // Slower modulation attack
      decay: 0.8,
      sustain: 0.6,
      release: 1,
    },
    volume: -16,            // Slightly lower to blend
  }).connect(output)
  synth.maxPolyphony = 32   // High polyphony for heavily overlapping ambient chords

  return {
    synth,
    play: (note, duration, velocity = 0.25, time?: number) => {
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    playChord: (notes, duration, velocity = 0.2, time?: number) => {
      const baseTime = time ?? Tone.now()
      notes.forEach((note, i) => {
        // Slight strum delay for humanization
        synth.triggerAttackRelease(note, duration, baseTime + i * 0.02, velocity)
      })
    },
    dispose: () => synth.dispose(),
  }
}

/**
 * Warm Pad - sustained harmony bed
 * Rich sawtooth with deep chorus for ambient width
 * Even slower envelope for spacey feel
 */
export function createWarmPadVoice(output: Tone.ToneAudioNode): Voice {
  // Internal chorus for extra width - deeper for ambient
  const chorus = new Tone.Chorus({
    frequency: 0.2,         // Slower modulation (was 0.3)
    depth: 0.6,             // Slightly deeper (was 0.5)
    wet: 0.5,               // More chorus (was 0.4)
  }).connect(output)
  chorus.start()

  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },  // Rich harmonics
    envelope: {
      attack: 5,            // Very slow attack (was 3)
      decay: 3,             // Longer decay (was 2)
      sustain: 0.85,        // Higher sustain (was 0.8)
      release: 8,           // Very long release (was 5)
    },
    volume: -18,            // Slightly louder to be main bed
  }).connect(chorus)
  synth.maxPolyphony = 32   // High polyphony for heavily overlapping ambient chords

  return {
    synth,
    play: (note, duration, velocity = 0.2, time?: number) => {
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    playChord: (notes, duration, velocity = 0.15, time?: number) => {
      // Play all notes together for pad
      synth.triggerAttackRelease(notes, duration, time, velocity)
    },
    dispose: () => {
      synth.dispose()
      chorus.dispose()
    },
  }
}

/**
 * Sub Bass - deep sine foundation
 * Pure sine wave for clean low end
 */
export function createSubBassVoice(output: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.5,
      decay: 0.3,
      sustain: 0.9,
      release: 2,
    },
    volume: -8,  // Prominent for foundation
  }).connect(output)
  synth.maxPolyphony = 8  // Allow overlap for ambient sustains

  return {
    synth,
    play: (note, duration, velocity = 0.35, time?: number) => {
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    dispose: () => synth.dispose(),
  }
}

/**
 * Arpeggiator Voice - very sparse melodic fragments
 * Softer triangle wave with longer release for ambient sparkle
 */
export function createArpVoice(output: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.02,         // Slightly softer attack (was 0.005)
      decay: 0.6,           // Longer decay (was 0.4)
      sustain: 0.1,         // Tiny bit of sustain for longer notes
      release: 2.5,         // Longer release for ambient tail (was 1.5)
    },
    volume: -24,            // Quieter for subtle sparkle (was -22)
  }).connect(output)
  synth.maxPolyphony = 16  // Allow overlap for ambient tails

  return {
    synth,
    play: (note, duration, velocity = 0.15, time?: number) => {  // Lower default velocity
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    dispose: () => synth.dispose(),
  }
}

/**
 * Tape Hiss Voice - constant ambient texture
 * Filtered pink noise for lo-fi character
 */
export interface BreathVoice {
  noise: Tone.Noise
  filter: Tone.Filter
  gain: Tone.Gain
  setIntensity: (intensity: number) => void
  start: () => void
  stop: () => void
  dispose: () => void
}

export function createTapeHissVoice(output: Tone.ToneAudioNode): BreathVoice {
  const noise = new Tone.Noise({
    type: 'pink',
    volume: -42,  // Very quiet, just texture
  })

  // High-pass to make it more "hissy" and less bassy
  const filter = new Tone.Filter({
    frequency: 6000,
    type: 'highpass',
    rolloff: -12,
  })

  const gain = new Tone.Gain(0.6)  // Start at moderate level

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(output)

  return {
    noise,
    filter,
    gain,
    setIntensity: (intensity: number) => {
      // 0-1 intensity controls volume
      gain.gain.rampTo(intensity * 0.8, 0.5)
    },
    start: () => noise.start(),
    stop: () => noise.stop(),
    dispose: () => {
      noise.dispose()
      filter.dispose()
      gain.dispose()
    },
  }
}

/**
 * Glass Pad - High register ethereal sine pad
 * Very slow attack, sits high in spectrum but subtle
 * Plays chord extensions (9ths, 7ths) in high register
 */
export function createGlassPadVoice(output: Tone.ToneAudioNode): Voice {
  // Subtle vibrato for organic movement
  const vibrato = new Tone.Vibrato({
    frequency: 3,
    depth: 0.03,         // Very subtle pitch variation
    wet: 0.4,
  }).connect(output)

  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: 4,           // Very slow attack (4-5s)
      decay: 2,
      sustain: 0.7,
      release: 6,          // Long release
    },
    volume: -20,           // Subtle - sits high but quiet
  }).connect(vibrato)
  synth.maxPolyphony = 24  // High polyphony for overlapping ethereal notes

  return {
    synth,
    play: (note, duration, velocity = 0.15, time?: number) => {
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    playChord: (notes, duration, velocity = 0.12, time?: number) => {
      synth.triggerAttackRelease(notes, duration, time, velocity)
    },
    dispose: () => {
      synth.dispose()
      vibrato.dispose()
    },
  }
}

/**
 * Shimmer Pad - Pitch-shifted reverb texture
 * Triangle oscillator with internal pitch shifter (+12 semitones)
 * Creates "shimmer reverb" effect - very wet, sparse ethereal accents
 */
export function createShimmerPadVoice(output: Tone.ToneAudioNode): Voice {
  // Pitch shifter for shimmer effect (+12 semitones = 1 octave up)
  const pitchShift = new Tone.PitchShift({
    pitch: 12,            // One octave up
    wet: 0.5,             // 50% shifted, 50% original
    windowSize: 0.1,
  }).connect(output)

  // Internal reverb for extra wash
  const reverb = new Tone.Reverb({
    decay: 8,             // Very long tail
    wet: 0.7,             // Mostly wet
    preDelay: 0.1,
  })

  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 3,
      decay: 2,
      sustain: 0.5,
      release: 8,          // Very long release for tail
    },
    volume: -22,           // Quiet - accent voice
  })

  // Chain: synth → reverb → pitchShift → output
  synth.connect(reverb)
  reverb.connect(pitchShift)
  synth.maxPolyphony = 4

  // Note: reverb.ready is available if needed, but voice starts immediately

  return {
    synth,
    play: (note, duration, velocity = 0.12, time?: number) => {
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    dispose: () => {
      synth.dispose()
      reverb.dispose()
      pitchShift.dispose()
    },
  }
}

/**
 * Breath Drone - Slowly evolving filtered noise
 * Pink noise with bandpass filter modulated by slow LFO
 * Creates "wind" or "breath" texture that blends with harmonic content
 */
export interface BreathDroneVoice {
  noise: Tone.Noise
  filter: Tone.Filter
  gain: Tone.Gain
  lfo: Tone.LFO
  setIntensity: (intensity: number) => void
  modulateWithChord: (brightness: number) => void  // Opens filter on brighter chords
  start: () => void
  stop: () => void
  dispose: () => void
}

export function createBreathDroneVoice(output: Tone.ToneAudioNode): BreathDroneVoice {
  const noise = new Tone.Noise({
    type: 'pink',
    volume: -28,           // Quiet texture
  })

  // Bandpass filter for "breath" character
  const filter = new Tone.Filter({
    frequency: 800,
    type: 'bandpass',
    Q: 2,                  // Moderate resonance
  })

  // Slow LFO to modulate filter cutoff (breathing effect)
  const lfo = new Tone.LFO({
    frequency: 0.05,       // Very slow - one cycle per 20 seconds
    min: 400,
    max: 1200,
    type: 'sine',
  })

  const gain = new Tone.Gain(0.5)

  // Connect: noise → filter → gain → output
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(output)

  // LFO modulates filter frequency
  lfo.connect(filter.frequency)

  return {
    noise,
    filter,
    gain,
    lfo,
    setIntensity: (intensity: number) => {
      gain.gain.rampTo(intensity * 0.6, 1)
    },
    modulateWithChord: (brightness: number) => {
      // brightness 0-1: 0 = dark chord, 1 = bright chord
      // Opens filter on brighter chords
      const minFreq = 300 + brightness * 200
      const maxFreq = 800 + brightness * 600
      lfo.min = minFreq
      lfo.max = maxFreq
    },
    start: () => {
      noise.start()
      lfo.start()
    },
    stop: () => {
      noise.stop()
      lfo.stop()
    },
    dispose: () => {
      noise.dispose()
      filter.dispose()
      gain.dispose()
      lfo.dispose()
    },
  }
}

/**
 * Awakening voice - soft, rising tone for first presence
 */
export function createAwakeningVoice(output: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.8,
      decay: 0.5,
      sustain: 0.4,
      release: 3,
    },
    volume: -16,
  }).connect(output)
  synth.maxPolyphony = 4

  return {
    synth,
    play: (note, duration, velocity = 0.3, time?: number) => {
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    dispose: () => synth.dispose(),
  }
}

/**
 * Lo-Fi Drum Voice - Balatro-style muted percussion
 *
 * Jazz-influenced, soft transients:
 * - Kick: Muted 808-style, sub-focused (not punchy)
 * - Snare: Brush/rim click texture (not full crack)
 * - Hi-hat: Filtered, sparse (almost like a shaker)
 */
export interface DrumVoice {
  kick: Tone.MembraneSynth
  snare: Tone.NoiseSynth
  hihat: Tone.NoiseSynth
  playKick: (time?: number, velocity?: number) => void
  playSnare: (time?: number, velocity?: number) => void
  playHihat: (time?: number, velocity?: number) => void
  dispose: () => void
}

export function createDrumVoice(
  mainOutput: Tone.ToneAudioNode,
  hihatOutput?: Tone.ToneAudioNode
): DrumVoice {
  // Kick: Muted 808-style, sub-focused
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,        // Quick pitch drop
    octaves: 4,              // Pitch sweep range
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.01,          // Soft attack (not clicky)
      decay: 0.4,            // Medium decay
      sustain: 0,
      release: 0.4,
    },
    volume: -12,
  }).connect(mainOutput)

  // Snare: Filtered noise for brush/rim sound
  // Add lowpass filter to tame harsh transients - let lead cut through
  const snareFilter = new Tone.Filter({
    frequency: 4500,         // Cut high frequencies for softer sound
    type: 'lowpass',
    rolloff: -12,
  }).connect(mainOutput)

  const snare = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: {
      attack: 0.001,
      decay: 0.2,
      sustain: 0.02,
      release: 0.1,
    },
    volume: -16,             // Pulled back further to let lead shine
  }).connect(snareFilter)

  // Hi-hat: Filtered to soften attack
  // Add lowpass to reduce harshness - lead needs high-frequency space
  const hihatFilter = new Tone.Filter({
    frequency: 7000,         // Tame the sizzle
    type: 'lowpass',
    rolloff: -12,
  }).connect(hihatOutput ?? mainOutput)

  const hihat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: 0.001,
      decay: 0.05,           // Very short for hi-hat tick
      sustain: 0,
      release: 0.02,
    },
    volume: -20,             // Even more subtle - texture not feature
  }).connect(hihatFilter)

  return {
    kick,
    snare,
    hihat,
    playKick: (time, velocity = 0.7) => kick.triggerAttackRelease('E1', '8n', time ?? Tone.now(), velocity),
    playSnare: (time, velocity = 0.6) => snare.triggerAttackRelease('16n', time ?? Tone.now(), velocity),
    playHihat: (time, velocity = 0.4) => hihat.triggerAttackRelease('32n', time ?? Tone.now(), velocity),
    dispose: () => {
      kick.dispose()
      snare.dispose()
      snareFilter.dispose()
      hihat.dispose()
      hihatFilter.dispose()
    },
  }
}

/**
 * Lead Melody Voice - warm FM synth for expressive phrases
 * Prominent in the mix with vibrato for expressiveness
 * Brighter timbre to cut through keys and pad
 */
export function createLeadMelodyVoice(output: Tone.ToneAudioNode): Voice {
  // Vibrato LFO for expressiveness
  const vibrato = new Tone.Vibrato({
    frequency: 4.5,           // Gentle vibrato rate
    depth: 0.08,              // Subtle pitch variation
    wet: 0.6,
  }).connect(output)

  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.5,         // More overtones for brightness
    modulationIndex: 1.8,     // More modulation for richer tone
    oscillator: { type: 'triangle' }, // Brighter than sine, cuts through mix
    envelope: {
      attack: 0.06,           // Slightly faster attack for definition
      decay: 0.7,
      sustain: 0.45,
      release: 1.8,
    },
    modulation: { type: 'triangle' }, // Triangle modulator for clarity
    modulationEnvelope: {
      attack: 0.08,
      decay: 0.25,
      sustain: 0.35,
      release: 0.6,
    },
    volume: -6,               // Prominent! Well above keys (-14)
  }).connect(vibrato)
  synth.maxPolyphony = 4

  return {
    synth,
    play: (note, duration, velocity = 0.3, time?: number) => {
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    dispose: () => {
      synth.dispose()
      vibrato.dispose()
    },
  }
}

/**
 * Awakening Voices - multi-layer synths for the intro sequence
 * Sub rumble, shimmer arpeggio, and rising motif
 */
export interface AwakeningVoices {
  sub: Tone.Synth           // Deep E1 sine for rumble
  shimmer: Tone.PolySynth   // High staggered arpeggio
  motif: Tone.PolySynth     // Rising melodic motif
  dispose: () => void
}

export function createAwakeningVoices(output: Tone.ToneAudioNode): AwakeningVoices {
  // Sub rumble - very deep sine
  const sub = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 2,              // Slow fade in
      decay: 0.5,
      sustain: 0.8,
      release: 3,
    },
    volume: -10,
  }).connect(output)

  // Shimmer - high register with fast attack
  const shimmer = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.01,
      decay: 1.5,
      sustain: 0.2,
      release: 2,
    },
    volume: -20,
  }).connect(output)
  shimmer.maxPolyphony = 6

  // Motif - warm FM for the rising melody
  const motif = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.5,
    modulationIndex: 1,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.15,
      decay: 0.6,
      sustain: 0.3,
      release: 2,
    },
    modulation: { type: 'triangle' },
    modulationEnvelope: {
      attack: 0.1,
      decay: 0.2,
      sustain: 0.3,
      release: 0.5,
    },
    volume: -14,
  }).connect(output)
  motif.maxPolyphony = 4

  return {
    sub,
    shimmer,
    motif,
    dispose: () => {
      sub.dispose()
      shimmer.dispose()
      motif.dispose()
    },
  }
}

// Legacy exports for backwards compatibility
export const createDroneVoice = createWarmPadVoice
export const createPadVoice = createWarmPadVoice
export const createSubVoice = createSubBassVoice
export const createBreathVoice = createTapeHissVoice

// These are no longer needed but kept for API compatibility
export function createShimmerVoice(output: Tone.ToneAudioNode): Voice {
  return createArpVoice(output)
}

export function createBellVoice(output: Tone.ToneAudioNode): Voice {
  const synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 6,
    modulationIndex: 2,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.001,
      decay: 0.6,
      sustain: 0.1,
      release: 2,
    },
    modulation: { type: 'square' },
    modulationEnvelope: {
      attack: 0.01,
      decay: 0.3,
      sustain: 0.2,
      release: 0.5,
    },
    volume: -24,
  }).connect(output)
  synth.maxPolyphony = 4

  return {
    synth,
    play: (note, duration, velocity = 0.15, time?: number) => {
      synth.triggerAttackRelease(note, duration, time, velocity)
    },
    dispose: () => synth.dispose(),
  }
}
