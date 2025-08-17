/**
 * Tap Shim - Observability gadget for monitoring values
 * Preserves pulse identity while recording observations
 */

import { z } from 'zod';
import { 
  GadgetSpec, GadgetId, Pulse, Value,
  createGadgetId, createPinoutId 
} from '../../core/types';

// ============================================================================
// Tap Configuration
// ============================================================================

export const TapConfig = z.object({
  // Where to send observations
  target: z.enum(['console', 'memory', 'callback']).default('console'),
  
  // Filtering
  filter: z.object({
    minInterval: z.number().optional().describe('Minimum ms between taps'),
    maxCount: z.number().optional().describe('Maximum taps to record'),
    predicate: z.any().optional().describe('Filter function')
  }).optional(),
  
  // Formatting
  format: z.object({
    includeTimestamp: z.boolean().default(true),
    includePulseId: z.boolean().default(true),
    includeMetadata: z.boolean().default(false),
    label: z.string().optional()
  }).optional(),
  
  // Callback for custom handling
  callback: z.any().optional()
});

export type TapConfig = z.infer<typeof TapConfig>;

// ============================================================================
// Tap State
// ============================================================================

export interface TapState {
  observations: TapObservation[];
  lastTapTime: number;
  tapCount: number;
}

export interface TapObservation {
  value: Value;
  pulseId?: string;
  timestamp: number;
  label?: string;
}

// ============================================================================
// Tap Gadget Implementation
// ============================================================================

export class TapGadget {
  private readonly config: TapConfig;
  private readonly state: TapState;
  
  constructor(id: string, config: Partial<TapConfig> = {}) {
    this.config = TapConfig.parse(config);
    this.state = {
      observations: [],
      lastTapTime: 0,
      tapCount: 0
    };
  }
  
  /**
   * Process a value/pulse passing through
   * Returns the value unchanged (pass-through)
   */
  process(input: Value | Pulse): Value | Pulse {
    // Extract value and pulse ID
    const isPulse = this.isPulse(input);
    const value = isPulse ? (input as Pulse).payload : input;
    const pulseId = isPulse ? (input as Pulse).reqId : undefined;
    
    // Check filters
    if (!this.shouldTap(value)) {
      return input; // Pass through unchanged
    }
    
    // Record observation
    const observation = this.createObservation(value, pulseId);
    this.recordObservation(observation);
    
    // Pass through unchanged - tap is non-intrusive
    return input;
  }
  
  /**
   * Check if input is a pulse
   */
  private isPulse(input: unknown): boolean {
    return typeof input === 'object' && 
           input !== null && 
           'reqId' in input;
  }
  
  /**
   * Check if we should tap this value
   */
  private shouldTap(value: Value): boolean {
    const filter = this.config.filter;
    if (!filter) return true;
    
    // Check interval
    if (filter.minInterval) {
      const now = Date.now();
      if (now - this.state.lastTapTime < filter.minInterval) {
        return false;
      }
    }
    
    // Check count
    if (filter.maxCount && this.state.tapCount >= filter.maxCount) {
      return false;
    }
    
    // Check predicate
    if (filter.predicate) {
      try {
        return filter.predicate(value);
      } catch {
        return true; // Default to tapping on predicate error
      }
    }
    
    return true;
  }
  
  /**
   * Create an observation record
   */
  private createObservation(value: Value, pulseId?: string): TapObservation {
    return {
      value,
      pulseId,
      timestamp: Date.now(),
      label: this.config.format?.label
    };
  }
  
  /**
   * Record an observation based on target
   */
  private recordObservation(observation: TapObservation): void {
    const format = this.config.format || {};
    
    switch (this.config.target) {
      case 'console': {
        const output = this.formatObservation(observation);
        console.log('[TAP]', output);
        break;
      }
      
      case 'memory': {
        this.state.observations.push(observation);
        break;
      }
      
      case 'callback': {
        if (this.config.callback) {
          try {
            this.config.callback(observation);
          } catch (error) {
            console.error('[TAP] Callback error:', error);
          }
        }
        break;
      }
    }
    
    // Update state
    this.state.lastTapTime = observation.timestamp;
    this.state.tapCount++;
  }
  
  /**
   * Format observation for output
   */
  private formatObservation(obs: TapObservation): string | object {
    const format = this.config.format;
    const parts: any = {};
    
    if (format?.label) {
      parts.label = format.label;
    }
    
    if (format?.includeTimestamp !== false) {
      parts.time = new Date(obs.timestamp).toISOString();
    }
    
    if (format?.includePulseId !== false && obs.pulseId) {
      parts.pulse = obs.pulseId;
    }
    
    parts.value = obs.value;
    
    return parts;
  }
  
  /**
   * Get current observations (for memory target)
   */
  getObservations(): readonly TapObservation[] {
    return this.state.observations;
  }
  
  /**
   * Clear observations
   */
  clearObservations(): void {
    this.state.observations = [];
    this.state.tapCount = 0;
  }
  
  /**
   * Get tap statistics
   */
  getStats(): {
    count: number;
    lastTap: number | null;
    memorySize: number;
  } {
    return {
      count: this.state.tapCount,
      lastTap: this.state.lastTapTime || null,
      memorySize: this.state.observations.length
    };
  }
}

// ============================================================================
// Tap Gadget Specification
// ============================================================================

/**
 * Create a tap gadget spec for use in boards
 */
export function createTapGadgetSpec(config?: Partial<TapConfig>): GadgetSpec {
  return {
    pinouts: [createPinoutId('tap-io')],
    params: {
      type: 'tap',
      config: config || {}
    },
    traits: [
      {
        trait: 'pure',
        confidence: 3,
        evidence: [{
          kind: 'declared',
          by: 'stdlib',
          at: new Date().toISOString()
        }]
      },
      {
        trait: 'deterministic',
        confidence: 3,
        evidence: [{
          kind: 'declared',
          by: 'stdlib',
          at: new Date().toISOString()
        }]
      }
    ]
  };
}

// ============================================================================
// Tap Pinout Definition
// ============================================================================

/**
 * Get the tap pinout definition
 */
export function getTapPinout() {
  return {
    id: createPinoutId('tap-io'),
    pins: {
      'in': {
        kind: 'ValueIn' as const,
        required: true
      },
      'out': {
        kind: 'ValueOut' as const,
        required: true
      },
      'monitor': {
        kind: 'EventOut' as const,
        required: false,
        domain: 'observation'
      }
    }
  };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a tap gadget instance
 */
export function createTapGadget(
  id: string = 'tap',
  config?: Partial<TapConfig>
): TapGadget {
  return new TapGadget(id, config);
}

// ============================================================================
// Tap Aspect Manifest
// ============================================================================

import { AspectManifest } from '../../runtime/aspects';
import { brand } from '../../core/types';

export const TapAspect: AspectManifest = {
  id: brand.aspectId('aspect://tap@1'),
  name: 'Tap',
  version: 1,
  targets: ['wire', 'pin'],
  at: 'tapIn',
  orderKey: 100,
  shimTemplate: brand.gadgetId('gadget://tap'),
  schema: (params: unknown) => TapConfig.parse(params),
  description: 'Non-intrusive observation of values flowing through wires',
  author: 'stdlib'
};