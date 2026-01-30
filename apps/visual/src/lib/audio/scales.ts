/**
 * E Minor Scale System with Jazz Voicings
 *
 * Inspired by Balatro OST: dark, contemplative E minor with extended harmonies.
 * Extended chords (7ths, 9ths) create jazz sophistication without complexity.
 */

// E Natural Minor (Aeolian) - the foundation
export const E_MINOR = {
  root: 'E',
  // Full scale
  notes: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
  // Octave ranges for each voice type
  sub: ['E1', 'E2'],
  bass: ['E2', 'G2', 'A2', 'B2', 'D3'],
  keys: ['E3', 'G3', 'A3', 'B3', 'D4', 'E4'],
  pad: ['E4', 'G4', 'A4', 'B4', 'D5'],
  arp: ['E5', 'G5', 'A5', 'B5', 'D6', 'E6'],
  // Lead melody range - two octaves for expressive phrases
  lead: ['E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'],
}

// Extended chord voicings (jazz) - notes from low to high
export const CHORDS: Record<string, string[]> = {
  Em9: ['E2', 'B3', 'D4', 'F#4', 'G4'],      // i9 - tonic with color
  Am9: ['A2', 'E3', 'G3', 'B3', 'C4'],       // iv9 - subdominant
  D7: ['D2', 'A3', 'C4', 'F#4'],             // VII7 - dominant character
  Cmaj7: ['C2', 'G3', 'B3', 'E4'],           // VI - relative major brightness
  Bm7: ['B2', 'F#3', 'A3', 'D4'],            // v7 - minor dominant
  G6: ['G2', 'D3', 'B3', 'E4'],              // III6 - major with 6th
}

// 8-bar progression in 7/4 - hypnotic asymmetric cycle
export const PROGRESSION = [
  'Em9',   // Bar 1: Home
  'Am9',   // Bar 2: Subdominant pull
  'D7',    // Bar 3: Tension
  'Cmaj7', // Bar 4: Brightness
  'Em9',   // Bar 5: Return home
  'Bm7',   // Bar 6: Minor dominant
  'Cmaj7', // Bar 7: Brightness again
  'G6',    // Bar 8: Resolution before repeat
]

// Melodic fragments for sparse arp notes
export const MELODIC_FRAGMENTS = [
  ['E5', 'G5'],           // Rising minor 3rd
  ['D5', 'B4'],           // Falling 3rd
  ['E5', 'F#5', 'G5'],    // Scale fragment up
  ['B5', 'A5', 'G5'],     // Descending
  ['G5', 'A5', 'B5'],     // Rising through 4
  ['E5', 'D5'],           // Falling 2nd
  ['A5', 'G5', 'E5'],     // Pentatonic fall
]

/**
 * Pick a random note from a scale
 */
export function randomNote(scale: string[]): string {
  return scale[Math.floor(Math.random() * scale.length)]
}

/**
 * Pick a weighted random note (favors lower indices)
 */
export function weightedNote(scale: string[]): string {
  const weights = scale.map((_, i) => 1 / (i + 1))
  const total = weights.reduce((a, b) => a + b, 0)
  const normalized = weights.map((w) => w / total)

  let rand = Math.random()
  for (let i = 0; i < scale.length; i++) {
    rand -= normalized[i]
    if (rand <= 0) return scale[i]
  }
  return scale[0]
}

/**
 * Get chord notes for a given chord name
 */
export function getChord(name: string): string[] {
  return CHORDS[name] || CHORDS['Em9']
}

/**
 * Get the root note of a chord (for bass)
 */
export function getChordRoot(name: string): string {
  const chord = CHORDS[name]
  return chord ? chord[0] : 'E2'
}

/**
 * Get random melodic fragment
 */
export function getRandomFragment(): string[] {
  return MELODIC_FRAGMENTS[Math.floor(Math.random() * MELODIC_FRAGMENTS.length)]
}

/**
 * Chord tones for lead melody - notes that sound good over each chord
 * In the lead octave range (E4-G5)
 */
export const CHORD_TONES: Record<string, string[]> = {
  Em9: ['E4', 'G4', 'B4', 'D5', 'F#5'],      // Root, m3, 5, 7, 9
  Am9: ['A4', 'C5', 'E5', 'G5'],              // Root, m3, 5, 7
  D7: ['D5', 'F#5', 'A4', 'C5'],              // Root, 3, 5, 7
  Cmaj7: ['C5', 'E5', 'G5', 'B4'],            // Root, 3, 5, 7
  Bm7: ['B4', 'D5', 'F#5', 'A4'],             // Root, m3, 5, 7
  G6: ['G4', 'B4', 'D5', 'E5'],               // Root, 3, 5, 6
}

/**
 * Get chord tones for a given chord name
 */
export function getChordTones(name: string): string[] {
  return CHORD_TONES[name] || CHORD_TONES['Em9']
}

/**
 * Get passing tones (non-chord scale tones) for melodic movement
 */
export function getPassingTones(chordName: string): string[] {
  const chordTones = CHORD_TONES[chordName] || CHORD_TONES['Em9']
  // Return lead scale notes that aren't chord tones
  return E_MINOR.lead.filter(note => !chordTones.includes(note))
}

// ============ MOTIF SYSTEM ============

export type ContourType = 'ascending' | 'descending' | 'arch' | 'invertedArch' | 'wave'

export interface LeadMotif {
  intervals: number[]      // Semitone intervals from starting note
  rhythm: number[]         // Relative durations (1 = quarter note equivalent)
  contour: ContourType     // Shape for dynamics/velocity contouring
  peakIndex?: number       // Which note is the climactic peak (defaults to highest)
}

/**
 * Pre-defined motif "seeds" - short melodic cells that repeat and develop
 * Intervals are semitones from root, rhythm is relative duration
 */
export const LEAD_MOTIFS: LeadMotif[] = [
  // Rising minor 3rd - hopeful, questioning
  { intervals: [0, 2, 3], rhythm: [1, 1, 2], contour: 'ascending' },

  // Falling 3rd to root - resolution, answering
  { intervals: [3, 2, 0], rhythm: [1, 1, 2], contour: 'descending' },

  // Arch to 5th - classic melodic shape, complete phrase
  { intervals: [0, 3, 7, 5, 3], rhythm: [1, 0.5, 1.5, 0.5, 1.5], contour: 'arch', peakIndex: 2 },

  // Neighbor tone wiggle - ornamental, jazzy
  { intervals: [0, -1, 0, 2], rhythm: [0.5, 0.5, 0.5, 1.5], contour: 'wave' },

  // Cascading descent - melancholic, flowing
  { intervals: [7, 5, 3, 2, 0], rhythm: [0.5, 0.5, 0.5, 0.5, 2], contour: 'descending' },

  // Leap and step - tension then smooth resolution
  { intervals: [0, 5, 3, 2], rhythm: [1, 1, 1, 1], contour: 'arch', peakIndex: 1 },

  // Minor 6th sigh - emotional, vocal-like
  { intervals: [8, 7, 5, 3], rhythm: [1.5, 0.5, 1, 1], contour: 'descending' },

  // Inverted arch - starts high, dips, returns for tension at end
  { intervals: [5, 3, 0, 2, 5], rhythm: [0.5, 0.5, 1.5, 0.5, 1], contour: 'invertedArch', peakIndex: 4 },

  // Pentatonic rise - bright, folk-like
  { intervals: [0, 2, 3, 5, 7], rhythm: [0.5, 0.5, 0.5, 0.5, 2], contour: 'ascending', peakIndex: 4 },

  // Call figure - short, memorable hook
  { intervals: [0, 3, 5, 3], rhythm: [0.5, 0.5, 1, 1], contour: 'arch', peakIndex: 2 },
]

/**
 * Pick a random motif
 */
export function pickMotif(): LeadMotif {
  return LEAD_MOTIFS[Math.floor(Math.random() * LEAD_MOTIFS.length)]
}

/**
 * Get semitone offset for a note name (E4 = 0, F4 = 1, etc relative to E4)
 */
function noteToSemitone(note: string): number {
  const noteNames: Record<string, number> = {
    'C': -4, 'C#': -3, 'Db': -3, 'D': -2, 'D#': -1, 'Eb': -1,
    'E': 0, 'F': 1, 'F#': 2, 'Gb': 2, 'G': 3, 'G#': 4, 'Ab': 4,
    'A': 5, 'A#': 6, 'Bb': 6, 'B': 7,
  }
  const match = note.match(/^([A-G][#b]?)(\d)$/)
  if (!match) return 0
  const [, name, octaveStr] = match
  const octave = parseInt(octaveStr, 10)
  return noteNames[name] + (octave - 4) * 12
}

/**
 * Get note name from semitone offset (relative to E4)
 */
function semitoneToNote(semitone: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  // E4 is semitone 0, E4 is MIDI 64
  // C4 is MIDI 60, so E4 offset in octave is 4 (C=0, C#=1, D=2, D#=3, E=4)
  const midiBase = 64 // E4
  const midi = midiBase + semitone
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  return `${noteNames[noteIndex]}${octave}`
}

/**
 * Transpose a motif's intervals to actual notes from a starting note
 * Constrains to E minor scale for musicality
 */
export function transposeMotif(motif: LeadMotif, startNote: string): string[] {
  const startSemitone = noteToSemitone(startNote)
  return motif.intervals.map(interval => {
    const targetSemitone = startSemitone + interval
    // Constrain to reasonable lead range (E4 to G5, roughly -0 to 15 semitones from E4)
    const constrained = Math.max(-4, Math.min(15, targetSemitone))
    return semitoneToNote(constrained)
  })
}

/**
 * Invert a motif - flip intervals (ascending becomes descending)
 */
export function invertMotif(motif: LeadMotif): LeadMotif {
  const inverted = motif.intervals.map(i => -i)
  // Shift to start at 0
  const min = Math.min(...inverted)
  const shifted = inverted.map(i => i - min)
  return {
    ...motif,
    intervals: shifted,
    contour: motif.contour === 'ascending' ? 'descending' :
             motif.contour === 'descending' ? 'ascending' : motif.contour,
    peakIndex: motif.peakIndex !== undefined ?
      motif.intervals.length - 1 - motif.peakIndex : undefined,
  }
}

/**
 * Augment a motif - double rhythm values (slower, more drawn out)
 */
export function augmentMotif(motif: LeadMotif): LeadMotif {
  return {
    ...motif,
    rhythm: motif.rhythm.map(r => r * 1.5),
  }
}

/**
 * Diminish a motif - halve rhythm values (faster, more urgent)
 */
export function diminishMotif(motif: LeadMotif): LeadMotif {
  return {
    ...motif,
    rhythm: motif.rhythm.map(r => r * 0.7),
  }
}

/**
 * Fragment a motif - take first N notes only
 */
export function fragmentMotif(motif: LeadMotif, length: number = 3): LeadMotif {
  return {
    intervals: motif.intervals.slice(0, length),
    rhythm: motif.rhythm.slice(0, length),
    contour: motif.contour,
    peakIndex: motif.peakIndex !== undefined && motif.peakIndex < length ?
      motif.peakIndex : undefined,
  }
}

/**
 * Get the peak index of a motif (highest note, or explicit peak)
 */
export function getMotifPeakIndex(motif: LeadMotif): number {
  if (motif.peakIndex !== undefined) return motif.peakIndex
  // Find index of highest interval
  let maxInterval = -Infinity
  let maxIndex = 0
  motif.intervals.forEach((interval, i) => {
    if (interval > maxInterval) {
      maxInterval = interval
      maxIndex = i
    }
  })
  return maxIndex
}

/**
 * Calculate velocity contour for a phrase based on its shape
 * Returns velocities that build to peak and resolve
 */
export function getContourVelocities(motif: LeadMotif, baseVelocity: number = 0.25): number[] {
  const peakIndex = getMotifPeakIndex(motif)
  const length = motif.intervals.length

  return motif.intervals.map((_, i) => {
    const distanceFromPeak = Math.abs(i - peakIndex)
    const maxDistance = Math.max(peakIndex, length - 1 - peakIndex)

    if (i === peakIndex) {
      // Peak note gets highest velocity
      return baseVelocity + 0.15
    } else {
      // Velocity decreases with distance from peak
      const falloff = distanceFromPeak / (maxDistance + 1)
      return baseVelocity + 0.1 * (1 - falloff)
    }
  })
}

/**
 * Apply a variation to a motif (0=original, 1=inverted, 2=augmented, 3=diminished, 4=fragment)
 */
export function applyMotifVariation(motif: LeadMotif, variation: number): LeadMotif {
  switch (variation % 5) {
    case 0: return motif
    case 1: return invertMotif(motif)
    case 2: return augmentMotif(motif)
    case 3: return diminishMotif(motif)
    case 4: return fragmentMotif(motif)
    default: return motif
  }
}
