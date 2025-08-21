/**
 * Drum Sequencer Application Template
 * A simple 8-step sequencer that uses the Selector gadget internally
 */

import { primitive, onAny, type PrimitiveTemplate } from './templates-v2'

/**
 * Sequencer Application Template
 */
export const SequencerTemplate: PrimitiveTemplate = primitive(
  {
    inputs: {
      // Clock input (from oscillator)
      clock: { type: 'boolean', default: false },
      
      // Transport
      playing: { type: 'boolean', default: false },
      reset: { type: 'boolean', default: false },
      
      // Pattern for each step (which drums are active)
      step0: { type: 'object', default: { kick: false, snare: false, hihat: false } },
      step1: { type: 'object', default: { kick: false, snare: false, hihat: false } },
      step2: { type: 'object', default: { kick: false, snare: false, hihat: false } },
      step3: { type: 'object', default: { kick: false, snare: false, hihat: false } },
      step4: { type: 'object', default: { kick: false, snare: false, hihat: false } },
      step5: { type: 'object', default: { kick: false, snare: false, hihat: false } },
      step6: { type: 'object', default: { kick: false, snare: false, hihat: false } },
      step7: { type: 'object', default: { kick: false, snare: false, hihat: false } },
      
      // Step length
      length: { type: 'number', default: 8 },
    },
    outputs: {
      // Current position
      currentStep: { type: 'number' },
      
      // Drum triggers
      kickTrigger: { type: 'boolean' },
      snareTrigger: { type: 'boolean' },
      hihatTrigger: { type: 'boolean' },
      
      // Visual feedback
      stepActive0: { type: 'boolean' },
      stepActive1: { type: 'boolean' },
      stepActive2: { type: 'boolean' },
      stepActive3: { type: 'boolean' },
      stepActive4: { type: 'boolean' },
      stepActive5: { type: 'boolean' },
      stepActive6: { type: 'boolean' },
      stepActive7: { type: 'boolean' },
      
      // Info
      isPlaying: { type: 'boolean' },
    }
  },
  (inputs, state) => {
    let currentStep = state?.currentStep ?? 0
    let lastClock = state?.lastClock ?? false
    
    // Handle reset
    if (inputs.reset) {
      currentStep = 0
    }
    
    // Handle clock (edge detection)
    const clockEdge = inputs.clock && !lastClock
    if (clockEdge && inputs.playing) {
      currentStep = (currentStep + 1) % (inputs.length || 8)
    }
    
    // Get current step's pattern
    const stepKey = `step${currentStep}`
    const pattern = inputs[stepKey] || { kick: false, snare: false, hihat: false }
    
    // Generate triggers only on clock edge when playing
    const triggering = clockEdge && inputs.playing
    
    // Create step active indicators
    const stepActives: Record<string, boolean> = {}
    for (let i = 0; i < 8; i++) {
      stepActives[`stepActive${i}`] = i === currentStep
    }
    
    return {
      outputs: {
        currentStep,
        kickTrigger: triggering && pattern.kick,
        snareTrigger: triggering && pattern.snare,
        hihatTrigger: triggering && pattern.hihat,
        ...stepActives,
        isPlaying: inputs.playing || false
      },
      state: {
        currentStep,
        lastClock: inputs.clock
      }
    }
  },
  'Drum sequencer with 8 steps',
  {
    activate: onAny(['clock', 'reset', 'playing']),
    initialState: () => ({ currentStep: 0, lastClock: false })
  }
)