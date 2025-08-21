/**
 * Audio stream gadgets for Web Audio integration
 * These gadgets bridge between signal values and audio parameters
 */

import { createGadget, createContact, signal, type Gadget, type Signal, type Value, calculatePrimitiveOutputStrength } from './types'
import { fromUnits } from './strength'

// Global audio context (lazy initialized)
let globalAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  return globalAudioContext
}

export function initAudioContext(): AudioContext {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext()
  }
  return globalAudioContext
}

export function resumeAudioContext(): Promise<void> {
  if (!globalAudioContext) {
    globalAudioContext = new AudioContext()
  }
  if (globalAudioContext.state === 'suspended') {
    return globalAudioContext.resume()
  }
  return Promise.resolve()
}

/**
 * Audio output gadget - plays waveform data through speakers
 * Expects input with { tag: 'waveform', value: Float32Array } or raw Float32Array
 */
export function createAudioOutput(id: string): Gadget & { 
  getAudioContext: () => AudioContext | null,
  isPlaying: boolean 
} {
  const gadget = createGadget(id)
  // NOT a primitive - we compute when play signal arrives
  let isPlaying = false
  let currentSource: AudioBufferSourceNode | null = null
  
  // Input for audio data
  const audioIn = createContact('audio', gadget, signal(null, 0), 'input')
  const gainIn = createContact('gain', gadget, signal(1, 0), 'input')
  const playIn = createContact('play', gadget, signal(false, 0), 'input')
  
  gadget.contacts.set('audio', audioIn)
  gadget.contacts.set('gain', gainIn)
  gadget.contacts.set('play', playIn)
  
  // Output for status
  const statusOut = createContact('status', gadget, signal('idle', 0), 'output')
  gadget.contacts.set('status', statusOut)
  
  gadget.compute = (inputs) => {
    const audioSignal = inputs.get('audio')
    const gainSignal = inputs.get('gain')
    const playSignal = inputs.get('play')
    
    const shouldPlay = playSignal?.value === true
    
    if (shouldPlay && audioSignal?.value && !isPlaying) {
      // Extract waveform data
      let samples: Float32Array | null = null
      
      if (audioSignal.value instanceof Float32Array) {
        samples = audioSignal.value
      } else if (typeof audioSignal.value === 'object' && 
                 audioSignal.value !== null &&
                 'tag' in audioSignal.value &&
                 audioSignal.value.tag === 'waveform' &&
                 'value' in audioSignal.value &&
                 audioSignal.value.value instanceof Float32Array) {
        samples = audioSignal.value.value
      }
      
      if (samples && samples.length > 0) {
        // Get audio context (should be initialized by now)
        const audioContext = getAudioContext()
        if (!audioContext) {
          return new Map([['status', { value: 'error-no-context', strength: 10000 }]])
        }
        
        // Create audio buffer
        const buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate)
        buffer.copyToChannel(samples, 0)
        
        // Stop any current playback
        if (currentSource) {
          currentSource.stop()
          currentSource.disconnect()
        }
        
        // Create new source
        currentSource = audioContext.createBufferSource()
        currentSource.buffer = buffer
        
        // Apply gain based on signal strength and gain input
        const gainNode = audioContext.createGain()
        const gainValue = (gainSignal?.value as number) || 1
        const strengthMultiplier = fromUnits(audioSignal.strength) // 0-1 range
        gainNode.gain.value = gainValue * strengthMultiplier
        
        // Connect audio graph
        currentSource.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        // Start playback
        currentSource.start()
        isPlaying = true
        
        // Handle playback end
        currentSource.onended = () => {
          isPlaying = false
          currentSource = null
        }
        
        return new Map([['status', { value: 'playing', strength: audioSignal.strength }]])
      }
    } else if (!shouldPlay && isPlaying && currentSource) {
      // Stop playback
      currentSource.stop()
      currentSource.disconnect()
      currentSource = null
      isPlaying = false
      return new Map([['status', { value: 'stopped', strength: 10000 }]])
    }
    
    return new Map([['status', { value: isPlaying ? 'playing' : 'idle', strength: 10000 }]])
  }
  
  return Object.assign(gadget, { getAudioContext, isPlaying }) as any
}

/**
 * Oscillator gadget - generates waveform data
 * Outputs Float32Array samples based on frequency and waveform type
 */
export function createOscillator(id: string, sampleRate: number = 44100): Gadget {
  const gadget = createGadget(id)
  gadget.primitive = true  // Mark as primitive - needs to compute when trigger changes
  
  // Inputs
  const frequencyIn = createContact('frequency', gadget, signal(440, 0), 'input')
  const waveformTypeIn = createContact('waveform_type', gadget, signal('sine', 0), 'input')
  const durationIn = createContact('duration', gadget, signal(1, 0), 'input') // seconds
  const amplitudeIn = createContact('amplitude', gadget, signal(0.5, 0), 'input')
  const triggerIn = createContact('trigger', gadget, signal(false, 0), 'input')
  
  gadget.contacts.set('frequency', frequencyIn)
  gadget.contacts.set('waveform_type', waveformTypeIn)
  gadget.contacts.set('duration', durationIn)
  gadget.contacts.set('amplitude', amplitudeIn)
  gadget.contacts.set('trigger', triggerIn)
  
  // Output
  const waveformOut = createContact('waveform_out', gadget, signal(null, 0), 'output')
  gadget.contacts.set('waveform_out', waveformOut)
  
  gadget.compute = (inputs) => {
    // Check if triggered
    const trigger = inputs.get('trigger')
    if (!trigger || trigger.value !== true) {
      return new Map()  // Don't generate waveform unless triggered
    }
    
    const freq = inputs.get('frequency')?.value as number || 440
    const waveType = inputs.get('waveform_type')?.value as string || 'sine'
    const duration = inputs.get('duration')?.value as number || 1
    const amplitude = inputs.get('amplitude')?.value as number || 0.5
    
    // Calculate number of samples
    const numSamples = Math.floor(sampleRate * duration)
    const samples = new Float32Array(numSamples)
    
    // Generate waveform
    const angularFreq = 2 * Math.PI * freq / sampleRate
    
    for (let i = 0; i < numSamples; i++) {
      const t = i * angularFreq
      
      switch (waveType) {
        case 'sine':
          samples[i] = Math.sin(t) * amplitude
          break
          
        case 'square':
          samples[i] = (Math.sin(t) > 0 ? 1 : -1) * amplitude
          break
          
        case 'sawtooth':
          const phase = (t % (2 * Math.PI)) / (2 * Math.PI)
          samples[i] = (2 * phase - 1) * amplitude
          break
          
        case 'triangle':
          const triPhase = (t % (2 * Math.PI)) / (2 * Math.PI)
          samples[i] = (triPhase < 0.5 
            ? 4 * triPhase - 1 
            : 3 - 4 * triPhase) * amplitude
          break
          
        case 'noise':
          samples[i] = (Math.random() * 2 - 1) * amplitude
          break
          
        default:
          samples[i] = 0
      }
    }
    
    // Use standard primitive output strength calculation
    const outputStrength = calculatePrimitiveOutputStrength(inputs, gadget)
    
    return new Map([[
      'waveform_out', 
      { value: { tag: 'waveform', value: samples }, strength: outputStrength }
    ]])
  }
  
  return gadget
}

/**
 * Envelope gadget - applies ADSR envelope to waveform
 */
export function createEnvelope(id: string): Gadget {
  const gadget = createGadget(id)
  // NOT a primitive - we compute when waveform arrives
  
  // Inputs
  const waveformIn = createContact('waveform_in', gadget, signal(null, 0), 'input')
  const attackIn = createContact('attack', gadget, signal(0.01, 0), 'input') // seconds
  const decayIn = createContact('decay', gadget, signal(0.1, 0), 'input')
  const sustainIn = createContact('sustain', gadget, signal(0.7, 0), 'input') // level 0-1
  const releaseIn = createContact('release', gadget, signal(0.2, 0), 'input')
  
  gadget.contacts.set('waveform_in', waveformIn)
  gadget.contacts.set('attack', attackIn)
  gadget.contacts.set('decay', decayIn)
  gadget.contacts.set('sustain', sustainIn)
  gadget.contacts.set('release', releaseIn)
  
  // Output
  const waveformOut = createContact('waveform_out', gadget, signal(null, 0), 'output')
  gadget.contacts.set('waveform_out', waveformOut)
  
  gadget.compute = (inputs) => {
    const waveformSignal = inputs.get('waveform_in')
    if (!waveformSignal?.value) return new Map()
    
    // Extract samples
    let samples: Float32Array | null = null
    if (waveformSignal.value instanceof Float32Array) {
      samples = waveformSignal.value
    } else if (waveformSignal.value.tag === 'waveform') {
      samples = waveformSignal.value.value
    }
    
    if (!samples) return new Map()
    
    const attack = (inputs.get('attack')?.value as number) || 0.01
    const decay = (inputs.get('decay')?.value as number) || 0.1
    const sustain = (inputs.get('sustain')?.value as number) || 0.7
    const release = (inputs.get('release')?.value as number) || 0.2
    
    // Apply envelope
    const output = new Float32Array(samples.length)
    const sampleRate = 44100 // TODO: make configurable
    
    const attackSamples = Math.floor(attack * sampleRate)
    const decaySamples = Math.floor(decay * sampleRate)
    const releaseSamples = Math.floor(release * sampleRate)
    const sustainSamples = samples.length - attackSamples - decaySamples - releaseSamples
    
    let i = 0
    
    // Attack phase
    for (; i < attackSamples && i < samples.length; i++) {
      const envelope = i / attackSamples
      output[i] = samples[i] * envelope
    }
    
    // Decay phase
    for (let j = 0; j < decaySamples && i < samples.length; i++, j++) {
      const envelope = 1 - (1 - sustain) * (j / decaySamples)
      output[i] = samples[i] * envelope
    }
    
    // Sustain phase
    for (let j = 0; j < sustainSamples && i < samples.length; i++, j++) {
      output[i] = samples[i] * sustain
    }
    
    // Release phase
    for (let j = 0; j < releaseSamples && i < samples.length; i++, j++) {
      const envelope = sustain * (1 - j / releaseSamples)
      output[i] = samples[i] * envelope
    }
    
    // Use standard primitive output strength calculation
    const outputStrength = calculatePrimitiveOutputStrength(inputs, gadget)
    
    return new Map([[
      'waveform_out',
      { value: { tag: 'waveform', value: output }, strength: outputStrength }
    ]])
  }
  
  return gadget
}

/**
 * Mixer gadget - combines multiple waveforms
 * Uses signal strength for mixing levels
 */
export function createMixer(id: string, numInputs: number = 4): Gadget {
  const gadget = createGadget(id)
  // NOT a primitive - we want to compute even with partial inputs
  
  // Create numbered inputs
  for (let i = 1; i <= numInputs; i++) {
    const input = createContact(`input${i}`, gadget, signal(null, 0), 'input')
    gadget.contacts.set(`input${i}`, input)
  }
  
  // Master gain input
  const masterGain = createContact('master', gadget, signal(1, 0), 'input')
  gadget.contacts.set('master', masterGain)
  
  // Mixed output
  const output = createContact('output', gadget, signal(null, 0), 'output')
  gadget.contacts.set('output', output)
  
  gadget.compute = (inputs) => {
    const waveforms: Array<{ samples: Float32Array, strength: number }> = []
    
    // Collect all input waveforms that have actual data
    for (let i = 1; i <= numInputs; i++) {
      const input = inputs.get(`input${i}`)
      // Only process inputs that have actual waveform data
      if (input && input.value && input.value !== null) {
        let samples: Float32Array | null = null
        if (input.value instanceof Float32Array) {
          samples = input.value
        } else if (typeof input.value === 'object' && 
                   'tag' in input.value &&
                   input.value.tag === 'waveform' &&
                   'value' in input.value &&
                   input.value.value instanceof Float32Array) {
          samples = input.value.value
        }
        
        if (samples && samples.length > 0) {
          waveforms.push({ samples, strength: input.strength })
        }
      }
    }
    
    // If no waveforms to mix, return empty
    if (waveforms.length === 0) {
      return new Map([['output', { value: null, strength: 0 }]])
    }
    
    // Find longest waveform
    const maxLength = Math.max(...waveforms.map(w => w.samples.length))
    const mixed = new Float32Array(maxLength)
    
    // Mix waveforms using strength as volume
    for (const { samples, strength } of waveforms) {
      const volume = fromUnits(strength) // Convert to 0-1 range
      for (let i = 0; i < samples.length && i < maxLength; i++) {
        mixed[i] += samples[i] * volume
      }
    }
    
    // Apply master gain
    const master = (inputs.get('master')?.value as number) || 1
    for (let i = 0; i < mixed.length; i++) {
      mixed[i] *= master
      // Soft clipping to prevent distortion
      mixed[i] = Math.tanh(mixed[i])
    }
    
    // Use standard primitive output strength calculation
    const outputStrength = calculatePrimitiveOutputStrength(inputs, gadget)
    
    return new Map([[
      'output',
      { value: { tag: 'waveform', value: mixed }, strength: outputStrength }
    ]])
  }
  
  return gadget
}