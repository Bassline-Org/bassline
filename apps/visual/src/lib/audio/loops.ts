/**
 * Generative loop system - Ambient chord-focused progression
 *
 * Spacey, ethereal soundscape:
 * - Extended chord voicings (Em9, Am9, D7, Cmaj7) for jazz sophistication
 * - Layered pad textures at different registers
 * - Very sparse arp fragments for subtle movement
 * - No drums or prominent melody - pure chord textures
 * - Long sustains with heavy overlap
 */

import * as Tone from 'tone'
import type { Voice, DrumVoice, BreathDroneVoice } from './voices'
import {
  PROGRESSION,
  getChord,
  getChordRoot,
  getRandomFragment,
  getChordTones,
  pickMotif,
  transposeMotif,
  applyMotifVariation,
  getContourVelocities,
  type LeadMotif,
} from './scales'

// Chord brightness values for breath drone modulation
// 0 = dark/minor, 1 = bright/major
const CHORD_BRIGHTNESS: Record<string, number> = {
  'Em9': 0.3,    // Minor - darker
  'Am9': 0.35,   // Minor - darker
  'D7': 0.7,     // Dominant - brighter
  'Cmaj7': 0.9,  // Major - brightest
}

export interface GenerativeLoop {
  loop: Tone.Loop | Tone.Part<{ time: number; notes?: string[]; note?: string }>
  start: (offset?: number) => void
  stop: () => void
  dispose: () => void
}

// 7/4 timing at 75 BPM - slowed down for ambient feel
// One bar = 7 quarter notes
// At 75 BPM: one quarter = 0.8s, one bar = 5.6s
export const TIMING = {
  bpm: 75,
  beatsPerBar: 7,
  // Duration of one bar in seconds (at 75 BPM)
  barDuration: (7 * 60) / 75,  // 5.6 seconds
  // Duration of two bars
  twoBarDuration: (14 * 60) / 75,  // 11.2 seconds
  // Duration of four bars (ambient chord change interval - slower)
  fourBarDuration: (28 * 60) / 75,  // 22.4 seconds
  // Duration of eight bars (for very sparse events)
  eightBarDuration: (56 * 60) / 75,  // 44.8 seconds
}

/**
 * Ambient Chord progression loop - triggers every bar with heavy overlap
 * Long sustains mean multiple chords blend together
 * Creates thick, continuous harmonic bed
 */
export function createChordLoop(voices: {
  pad: Voice
  keys: Voice
}): GenerativeLoop {
  let chordIndex = 0

  // Loop every bar (~5.6s) - frequent triggers with long sustains = dense texture
  const loop = new Tone.Loop((time) => {
    const chordName = PROGRESSION[chordIndex % PROGRESSION.length]
    const chordNotes = getChord(chordName)

    // Pad: full sustained chord (skip bass note for clarity)
    const padNotes = chordNotes.slice(1)  // Remove root, pad plays upper voicing
    if (voices.pad.playChord) {
      // 18 second sustain - overlaps with next 3 chord changes
      voices.pad.playChord(padNotes, '18', 0.1, time)
    }

    // Keys (now a slow pad): also play full chord for layered texture
    // Staggered entry creates wash effect
    if (voices.keys.playChord) {
      const keysDelay = time + 1  // Enter 1s after pad
      voices.keys.playChord(padNotes, '15', 0.08, keysDelay)
    } else {
      // Fallback: play notes with stagger
      padNotes.forEach((note, i) => {
        voices.keys.play(note, '12', 0.07, time + 1 + i * 0.3)
      })
    }

    chordIndex++
  }, TIMING.barDuration)

  return {
    loop,
    start: (offset = 0) => loop.start(offset),
    stop: () => loop.stop(),
    dispose: () => loop.dispose(),
  }
}

/**
 * Sub bass loop - plays root on each chord change
 * Follows 1-bar chord changes with overlap
 */
export function createSubLoop(voice: Voice): GenerativeLoop {
  let chordIndex = 0

  const loop = new Tone.Loop((time) => {
    const chordName = PROGRESSION[chordIndex % PROGRESSION.length]
    const root = getChordRoot(chordName)

    // Play root with sustain that overlaps into next chord
    voice.play(root, '10', 0.2, time)

    // Occasionally add soft octave for movement
    if (Math.random() < 0.25) {
      const midPoint = time + 2.5
      const octaveUp = root.replace(/\d/, (d) => String(Number(d) + 1))
      voice.play(octaveUp, '4', 0.08, midPoint)
    }

    chordIndex++
  }, TIMING.barDuration)

  return {
    loop,
    start: (offset = 0) => loop.start(offset),
    stop: () => loop.stop(),
    dispose: () => loop.dispose(),
  }
}

/**
 * Melodic fragment loop - very sparse arpeggiator notes
 * 15% chance each bar to play a fragment (was 30%)
 * Longer spacing and note durations for ambient feel
 */
export function createMelodicLoop(voice: Voice): GenerativeLoop {
  const loop = new Tone.Loop((time) => {
    // Only play 15% of the time for extreme sparseness
    if (Math.random() > 0.15) return

    const fragment = getRandomFragment()
    const startBeat = Math.floor(Math.random() * 3)  // Start on beat 0-2
    const noteSpacing = 0.4 + Math.random() * 0.2    // 400-600ms between notes (was 250-450)

    fragment.forEach((note, i) => {
      const noteTime = time + (startBeat * 60) / TIMING.bpm + i * noteSpacing
      // Lower velocity for subtlety
      const velocity = 0.08 + Math.random() * 0.06
      // Longer note duration for ambient tail
      voice.play(note, '4n', velocity, noteTime)  // Quarter note (was 8th)
    })
  }, TIMING.barDuration)

  return {
    loop,
    start: (offset = 0) => loop.start(offset),
    stop: () => loop.stop(),
    dispose: () => loop.dispose(),
  }
}

/**
 * 7/4 Drum Pattern - Fully generative Balatro style
 *
 * Base pattern (7 beats):
 *   Beat:  1   2   3   4   5   6   7
 *   Kick:  X   .   .   X   .   .   .    (beats 1 & 4 - always)
 *   Snare: .   .   X   .   .   X   .    (beats 3 & 6 - backbeat)
 *
 * All elements have generative variations layered on top
 */
export function createDrumLoop(drums: DrumVoice): GenerativeLoop {
  const beatDuration = 60 / TIMING.bpm  // 0.8s at 75 BPM
  let lastHatPattern = ''
  let lastKickPattern = ''
  let lastSnarePattern = ''

  const loop = new Tone.Loop((time) => {
    // ============ GENERATIVE KICK ============
    const kickPatterns = ['standard', 'double', 'syncopated', 'sparse', 'busy']
    let kickPattern = kickPatterns[Math.floor(Math.random() * kickPatterns.length)]
    if (kickPattern === lastKickPattern || Math.random() < 0.4) {
      kickPattern = 'standard'  // Bias toward standard
    }
    lastKickPattern = kickPattern

    if (kickPattern === 'standard') {
      // Classic 1 & 4
      drums.playKick(time, 0.8)
      drums.playKick(time + 3 * beatDuration, 0.7)
    } else if (kickPattern === 'double') {
      // Double hit on beat 1, single on 4
      drums.playKick(time, 0.8)
      drums.playKick(time + 0.12, 0.5)  // Ghost double
      drums.playKick(time + 3 * beatDuration, 0.7)
    } else if (kickPattern === 'syncopated') {
      // Hits on 1, 3.5 (and of 3), 5
      drums.playKick(time, 0.8)
      drums.playKick(time + 2.5 * beatDuration, 0.6)  // And of 3
      drums.playKick(time + 4 * beatDuration, 0.65)   // Beat 5
    } else if (kickPattern === 'sparse') {
      // Just beat 1
      drums.playKick(time, 0.85)
      // Maybe a soft one on 5
      if (Math.random() < 0.4) {
        drums.playKick(time + 4 * beatDuration, 0.45)
      }
    } else if (kickPattern === 'busy') {
      // More kicks - 1, 2.5, 4, 6
      drums.playKick(time, 0.8)
      drums.playKick(time + 1.5 * beatDuration, 0.5)  // And of 2
      drums.playKick(time + 3 * beatDuration, 0.7)
      drums.playKick(time + 5 * beatDuration, 0.55)   // Beat 6
    }

    // ============ GENERATIVE SNARE ============
    const snarePatterns = ['standard', 'ghost', 'displaced', 'rolls', 'minimal']
    let snarePattern = snarePatterns[Math.floor(Math.random() * snarePatterns.length)]
    if (snarePattern === lastSnarePattern || Math.random() < 0.35) {
      snarePattern = 'standard'
    }
    lastSnarePattern = snarePattern

    if (snarePattern === 'standard') {
      // Classic 3 & 6 backbeat
      drums.playSnare(time + 2 * beatDuration, 0.8)
      drums.playSnare(time + 5 * beatDuration, 0.7)
    } else if (snarePattern === 'ghost') {
      // Backbeat with ghost notes
      drums.playSnare(time + 1 * beatDuration, 0.25)  // Ghost on 2
      drums.playSnare(time + 2 * beatDuration, 0.8)   // Main on 3
      drums.playSnare(time + 4 * beatDuration, 0.2)   // Ghost on 5
      drums.playSnare(time + 5 * beatDuration, 0.7)   // Main on 6
    } else if (snarePattern === 'displaced') {
      // Slightly off - creates tension
      drums.playSnare(time + 2.5 * beatDuration, 0.75)  // Late 3
      drums.playSnare(time + 5 * beatDuration, 0.7)     // Normal 6
      if (Math.random() < 0.5) {
        drums.playSnare(time + 6.5 * beatDuration, 0.5)  // Extra hit before bar end
      }
    } else if (snarePattern === 'rolls') {
      // Drag/buzz before the main hits
      // Buzz into 3
      drums.playSnare(time + 1.7 * beatDuration, 0.3)
      drums.playSnare(time + 1.85 * beatDuration, 0.4)
      drums.playSnare(time + 2 * beatDuration, 0.8)
      // Normal 6
      drums.playSnare(time + 5 * beatDuration, 0.7)
    } else if (snarePattern === 'minimal') {
      // Just one snare hit
      const hitBeat = Math.random() < 0.7 ? 2 : 5
      drums.playSnare(time + hitBeat * beatDuration, 0.8)
    }

    // ============ GENERATIVE HI-HAT ============
    const hatPatterns = ['straight', 'triplets', 'offbeat', 'sparse', 'fill', 'shuffle']
    let hatPattern = hatPatterns[Math.floor(Math.random() * hatPatterns.length)]
    if (hatPattern === lastHatPattern || Math.random() < 0.3) {
      hatPattern = 'straight'
    }
    lastHatPattern = hatPattern

    if (hatPattern === 'straight') {
      for (let beat = 0; beat < 7; beat++) {
        if (Math.random() < 0.92) {
          const isStrong = beat % 2 === 0
          const velocity = (isStrong ? 0.6 : 0.4) + Math.random() * 0.12
          const swing = (Math.random() - 0.5) * 0.015
          drums.playHihat(time + beat * beatDuration + swing, velocity)
        }
      }
    } else if (hatPattern === 'triplets') {
      const tripletBeats = [1, 4, 6]
      for (let beat = 0; beat < 7; beat++) {
        const beatTime = time + beat * beatDuration
        if (tripletBeats.includes(beat) && Math.random() < 0.7) {
          const tripletSpacing = beatDuration / 3
          for (let t = 0; t < 3; t++) {
            const velocity = t === 0 ? 0.5 : 0.3 + Math.random() * 0.1
            drums.playHihat(beatTime + t * tripletSpacing, velocity)
          }
        } else if (Math.random() < 0.85) {
          const velocity = (beat % 2 === 0 ? 0.55 : 0.38) + Math.random() * 0.1
          drums.playHihat(beatTime, velocity)
        }
      }
    } else if (hatPattern === 'offbeat') {
      for (let beat = 0; beat < 7; beat++) {
        const beatTime = time + beat * beatDuration
        if (Math.random() < 0.6) {
          drums.playHihat(beatTime, 0.25 + Math.random() * 0.1)
        }
        if (Math.random() < 0.85) {
          drums.playHihat(beatTime + beatDuration * 0.5, 0.5 + Math.random() * 0.15)
        }
      }
    } else if (hatPattern === 'sparse') {
      const sparseBeats = [0, 2, 4, 6]
      sparseBeats.forEach(beat => {
        if (Math.random() < 0.8) {
          const swing = (Math.random() - 0.5) * 0.02
          drums.playHihat(time + beat * beatDuration + swing, 0.5 + Math.random() * 0.15)
        }
      })
    } else if (hatPattern === 'fill') {
      const fillStart = Math.floor(Math.random() * 4)
      const fillLength = 2 + Math.floor(Math.random() * 2)
      for (let beat = 0; beat < 7; beat++) {
        const beatTime = time + beat * beatDuration
        if (beat >= fillStart && beat < fillStart + fillLength) {
          for (let s = 0; s < 4; s++) {
            const velocity = 0.35 + Math.random() * 0.2 - s * 0.03
            drums.playHihat(beatTime + s * (beatDuration / 4), velocity)
          }
        } else if (Math.random() < 0.85) {
          drums.playHihat(beatTime, 0.45 + Math.random() * 0.15)
        }
      }
    } else if (hatPattern === 'shuffle') {
      for (let beat = 0; beat < 7; beat++) {
        const beatTime = time + beat * beatDuration
        if (Math.random() < 0.9) {
          drums.playHihat(beatTime, 0.5 + Math.random() * 0.15)
        }
        if (Math.random() < 0.75) {
          drums.playHihat(beatTime + beatDuration * 0.67, 0.35 + Math.random() * 0.1)
        }
      }
    }
  }, TIMING.barDuration)

  return {
    loop,
    start: (offset = 0) => loop.start(offset),
    stop: () => loop.stop(),
    dispose: () => loop.dispose(),
  }
}

/**
 * Lead Melody Loop - motif-based generative phrases
 *
 * Creates recognizable, musical melody through:
 * - Pre-defined motif seeds that repeat and develop
 * - Contour-aware dynamics (build to peak, resolve)
 * - Motif variation (invert, augment, fragment)
 * - Call-and-response phrasing
 * - Chord-aware starting notes
 */
export function createLeadMelodyLoop(voice: Voice): GenerativeLoop {
  // Persistent state across bars for musical continuity
  let currentMotif: LeadMotif = pickMotif()
  let motifVariation = 0       // 0=original, 1=inverted, 2=augmented, etc.
  let barsWithMotif = 0        // How long we've used this motif
  let lastPhraseEndNote = ''   // For call-and-response connection
  let chordIndex = 0
  let silentBars = 0           // Track consecutive rests for pacing

  const loop = new Tone.Loop((time) => {
    const chordName = PROGRESSION[chordIndex % PROGRESSION.length]
    const chordTones = getChordTones(chordName)
    const isChordChange = chordIndex % 2 === 0  // Chords change every 2 bars

    // ============ PACING: When to play vs rest ============
    // Higher chance to play on chord changes for "announcement"
    const playChance = isChordChange ? 0.85 : 0.7

    if (Math.random() > playChance) {
      silentBars++
      // After 2+ silent bars, definitely play next time
      if (silentBars < 2) {
        chordIndex++
        return
      }
    }
    silentBars = 0

    // ============ MOTIF DEVELOPMENT ============
    // Every 2-4 bars, maybe develop or change the motif
    if (barsWithMotif >= 2 && Math.random() < 0.4) {
      if (Math.random() < 0.65) {
        // Vary the current motif (keeps it recognizable)
        motifVariation = (motifVariation + 1) % 5
      } else {
        // Pick a completely new motif
        currentMotif = pickMotif()
        motifVariation = 0
      }
      barsWithMotif = 0
    }

    // Apply variation to get the working motif
    const workingMotif = applyMotifVariation(currentMotif, motifVariation)

    // ============ STARTING NOTE SELECTION ============
    // Choose starting note based on chord and phrase context
    let startNote: string

    if (lastPhraseEndNote && Math.random() < 0.4) {
      // Call-and-response: start from where last phrase ended
      startNote = lastPhraseEndNote
    } else if (isChordChange && Math.random() < 0.7) {
      // On chord change, start from chord root (strong)
      startNote = chordTones[0]
    } else {
      // Pick from chord tones, favor root and 5th
      const weights = [0.35, 0.15, 0.25, 0.15, 0.1]  // Favor root, then 5th
      let rand = Math.random()
      let noteIndex = 0
      for (let i = 0; i < weights.length && i < chordTones.length; i++) {
        rand -= weights[i]
        if (rand <= 0) {
          noteIndex = i
          break
        }
      }
      startNote = chordTones[noteIndex] || chordTones[0]
    }

    // ============ GENERATE PHRASE FROM MOTIF ============
    const notes = transposeMotif(workingMotif, startNote)
    const velocities = getContourVelocities(workingMotif, 0.28)
    const baseRhythmUnit = 60 / TIMING.bpm * 0.5  // Eighth note base

    // Calculate start beat with slight humanization
    const startBeat = Math.floor(Math.random() * 2)  // Start on beat 0-1
    const humanize = (Math.random() - 0.5) * 0.02    // ±20ms

    let noteTime = time + (startBeat * 60) / TIMING.bpm + humanize

    // ============ PLAY PHRASE WITH CONTOUR ============
    notes.forEach((note, i) => {
      const duration = workingMotif.rhythm[i] * baseRhythmUnit
      const velocity = velocities[i]

      // Convert duration to Tone.js notation
      let durationStr: string
      if (duration >= 1.2) {
        durationStr = '2n'   // Half note
      } else if (duration >= 0.6) {
        durationStr = '4n'   // Quarter note
      } else if (duration >= 0.3) {
        durationStr = '8n'   // Eighth note
      } else {
        durationStr = '16n'  // Sixteenth note
      }

      voice.play(note, durationStr, velocity, noteTime)
      noteTime += duration
    })

    // Remember last note for call-and-response
    lastPhraseEndNote = notes[notes.length - 1]

    // ============ OCCASIONAL SUSTAINED TAIL NOTE ============
    // Sometimes add a long held note after the motif for breathing
    if (Math.random() < 0.25 && noteTime < time + TIMING.barDuration - 1) {
      const tailNote = chordTones[Math.floor(Math.random() * 3)]  // Root, 3rd, or 5th
      voice.play(tailNote, '2n', 0.2, noteTime + 0.3)
    }

    barsWithMotif++
    chordIndex++
  }, TIMING.barDuration)

  return {
    loop,
    start: (offset = 0) => loop.start(offset),
    stop: () => loop.stop(),
    dispose: () => loop.dispose(),
  }
}

// ============ NEW AMBIENT VOICES ============

/**
 * Glass Pad Loop - High register ethereal accents
 * Plays top 2-3 notes of current chord in high octave
 * 40% chance each bar, long sustain for overlap
 */
export function createGlassPadLoop(voice: Voice): GenerativeLoop {
  let chordIndex = 0

  const loop = new Tone.Loop((time) => {
    // 40% chance to play - still sparse but more frequent checks
    if (Math.random() > 0.4) {
      chordIndex++
      return
    }

    const chordName = PROGRESSION[chordIndex % PROGRESSION.length]
    const chordNotes = getChord(chordName)

    // Get top 2-3 notes and transpose up an octave for glass register
    const topNotes = chordNotes.slice(-3).map(note => {
      // Transpose up one octave (e.g., E4 -> E5)
      return note.replace(/\d/, (d) => String(Number(d) + 1))
    })

    // Play with stagger for ethereal wash
    topNotes.forEach((note, i) => {
      const noteTime = time + i * 0.4
      voice.play(note, '10', 0.1, noteTime)  // 10 second sustain
    })

    chordIndex++
  }, TIMING.barDuration)

  return {
    loop,
    start: (offset = 0) => loop.start(offset),
    stop: () => loop.stop(),
    dispose: () => loop.dispose(),
  }
}

/**
 * Shimmer Accent Loop - Sparse ethereal touches
 * Plays single high note every 4-8 bars for "sparkle" moments
 * Random timing within bar for organic feel
 */
export function createShimmerAccentLoop(voice: Voice): GenerativeLoop {
  let chordIndex = 0
  let barsUntilNext = 4 + Math.floor(Math.random() * 4)  // 4-8 bars

  const loop = new Tone.Loop((time) => {
    barsUntilNext--

    if (barsUntilNext > 0) return

    // Reset counter for next shimmer (4-8 bars)
    barsUntilNext = 4 + Math.floor(Math.random() * 4)

    const chordName = PROGRESSION[chordIndex % PROGRESSION.length]
    const chordNotes = getChord(chordName)

    // Pick a high note from the chord, transpose up 2 octaves for shimmer register
    const noteIndex = Math.floor(Math.random() * chordNotes.length)
    const baseNote = chordNotes[noteIndex]
    const shimmerNote = baseNote.replace(/\d/, (d) => String(Number(d) + 2))

    // Random time offset within the bar for organic feel
    const randomOffset = Math.random() * 2  // 0-2 seconds into the bar
    voice.play(shimmerNote, '8', 0.08, time + randomOffset)  // 8 second sustain

    chordIndex++
  }, TIMING.barDuration)

  return {
    loop,
    start: (offset = 0) => loop.start(offset),
    stop: () => loop.stop(),
    dispose: () => loop.dispose(),
  }
}

/**
 * Breath Drone Loop - Modulates the breath drone filter with chord changes
 * Follows chord brightness: opens filter on brighter chords (D7, Cmaj7)
 * Continuous texture - follows 1-bar chord changes
 */
export function createBreathDroneLoop(breathDrone: BreathDroneVoice): GenerativeLoop {
  let chordIndex = 0

  const loop = new Tone.Loop(() => {
    const chordName = PROGRESSION[chordIndex % PROGRESSION.length]
    const brightness = CHORD_BRIGHTNESS[chordName] ?? 0.5

    // Modulate breath filter based on chord brightness
    breathDrone.modulateWithChord(brightness)

    chordIndex++
  }, TIMING.barDuration)

  return {
    loop,
    start: (offset = 0) => loop.start(offset),
    stop: () => loop.stop(),
    dispose: () => loop.dispose(),
  }
}

// ============ MAIN LOOP CREATORS ============

/**
 * Create ambient chord-focused loops (no drums, no lead melody)
 * Pure layered pad textures with sparse accents
 */
export function createBalatroLoops(voices: {
  pad: Voice
  keys: Voice
  sub: Voice
  arp: Voice
  glassPad?: Voice
  shimmer?: Voice
  breathDrone?: BreathDroneVoice
  // Legacy - kept for API compat but not used
  lead?: Voice
  drums?: DrumVoice
}): GenerativeLoop[] {
  const loops: GenerativeLoop[] = [
    // Core harmonic bed
    createChordLoop({ pad: voices.pad, keys: voices.keys }),
    createSubLoop(voices.sub),
    // Very sparse arp for subtle movement
    createMelodicLoop(voices.arp),
  ]

  // New ambient voices
  if (voices.glassPad) {
    loops.push(createGlassPadLoop(voices.glassPad))
  }

  if (voices.shimmer) {
    loops.push(createShimmerAccentLoop(voices.shimmer))
  }

  if (voices.breathDrone) {
    loops.push(createBreathDroneLoop(voices.breathDrone))
  }

  // NOTE: drums and lead are intentionally NOT added
  // This creates the ambient, no-drums, no-melody soundscape

  return loops
}

/**
 * Start loops with staggered offsets
 */
export function startLoopsStaggered(
  loops: GenerativeLoop[],
  baseOffset = 0
): void {
  const now = Tone.now()
  loops.forEach((loop, i) => {
    // Stagger by fractions of a beat for organic feel
    // Use explicit time to avoid Tone.js timing warnings
    loop.start(now + baseOffset + i * 0.3)
  })
}

/**
 * Dispose all loops
 */
export function disposeLoops(loops: GenerativeLoop[]): void {
  loops.forEach((loop) => loop.dispose())
}

// Legacy export for backwards compatibility
export function createAmbientLoops(voices: {
  drone: Voice
  pad: Voice
  sub?: Voice
  bell?: Voice
}): GenerativeLoop[] {
  // Map old voice names to new structure
  return createBalatroLoops({
    pad: voices.drone,
    keys: voices.pad,
    sub: voices.sub || voices.drone,
    arp: voices.bell || voices.pad,
  })
}
