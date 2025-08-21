/**
 * Oscillator Application Template
 * Generates periodic waveforms that can drive other gadgets in the network
 */

import { primitive, always, type PrimitiveTemplate } from './templates-v2'

/**
 * Oscillator Application Template
 * Uses external timing (Web Audio or setInterval) to write values into the network
 */
export const OscillatorTemplate: PrimitiveTemplate = primitive(
  {
    inputs: {
      // Control inputs
      frequency: { type: 'number', default: 1 }, // Hz
      amplitude: { type: 'number', default: 1 }, // 0-1
      waveform: { type: 'string', default: 'sine' }, // 'sine', 'square', 'saw', 'triangle'
      phase: { type: 'number', default: 0 }, // Phase offset in radians
      
      // Transport controls
      playing: { type: 'boolean', default: false },
      reset: { type: 'boolean', default: false },
      
      // External clock input (for sync)
      externalClock: { type: 'number', default: null },
      
      // Modulation inputs
      frequencyMod: { type: 'number', default: 0 },
      amplitudeMod: { type: 'number', default: 0 },
      phaseMod: { type: 'number', default: 0 },
    },
    outputs: {
      // Wave outputs
      waveValue: { type: 'number' }, // Current wave value (-1 to 1)
      normalizedValue: { type: 'number' }, // 0 to 1
      currentPhase: { type: 'number' }, // Current phase (0 to 2π)
      
      // Trigger outputs
      trigger: { type: 'boolean' }, // Pulse on zero crossing
      gate: { type: 'boolean' }, // High when wave > 0
      
      // Info outputs
      actualFrequency: { type: 'number' }, // Actual frequency after modulation
      isPlaying: { type: 'boolean' },
      
      // For visualization
      waveformType: { type: 'string' },
    }
  },
  (inputs, state) => {
    // This is a placeholder - the actual oscillator timing will be handled
    // by the React component using Web Audio or setInterval
    // This compute function just passes through the current state
    
    const freq = Math.max(0.01, (inputs.frequency || 1) + (inputs.frequencyMod || 0))
    const amp = Math.max(0, Math.min(1, (inputs.amplitude || 1) + (inputs.amplitudeMod || 0)))
    const phase = ((inputs.phase || 0) + (inputs.phaseMod || 0)) % (2 * Math.PI)
    
    // The React component will actually generate the wave values
    // and write them to the network. This is just for configuration.
    
    return {
      outputs: {
        waveValue: 0, // Will be set by the component
        normalizedValue: 0.5, // Will be set by the component
        currentPhase: phase,
        trigger: false, // Will be set by the component
        gate: false, // Will be set by the component
        actualFrequency: freq,
        isPlaying: inputs.playing || false,
        waveformType: inputs.waveform || 'sine'
      },
      state: {
        frequency: freq,
        amplitude: amp,
        waveform: inputs.waveform || 'sine',
        phase: phase,
        playing: inputs.playing || false
      }
    }
  },
  'Oscillator for generating periodic waveforms',
  {
    activate: always(), // Always responsive to control changes
    initialState: () => ({
      frequency: 1,
      amplitude: 1,
      waveform: 'sine',
      phase: 0,
      playing: false
    })
  }
)