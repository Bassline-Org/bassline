/**
 * Credit Gate Shim - Credit-based flow control for scheduling
 * Gates propagation based on available credits, enabling deterministic scheduling
 */

import { z } from 'zod';
import { 
  GadgetSpec, GadgetId, PinoutId, Pulse, Value,
  createGadgetId, createPinoutId 
} from '../../core/types';

// ============================================================================
// Credit Gate Configuration
// ============================================================================

export const CreditGateConfig = z.object({
  // Initial credits
  initialCredits: z.number().int().min(0).default(1),
  
  // Maximum credits (bounded buffer)
  maxCredits: z.number().int().positive().default(10),
  
  // Credit consumption
  creditsPerItem: z.number().int().positive().default(1),
  
  // Behavior when no credits
  onNoCredits: z.enum(['queue', 'drop', 'error']).default('queue'),
  
  // Queue settings
  queue: z.object({
    maxSize: z.number().positive().default(100),
    fifo: z.boolean().default(true) // FIFO vs LIFO
  }).optional(),
  
  // Auto-demand generation
  autoDemand: z.boolean().default(true).describe('Automatically signal demand when depleted')
});

export type CreditGateConfig = z.infer<typeof CreditGateConfig>;

// ============================================================================
// Credit Gate State
// ============================================================================

export interface CreditState {
  available: number;
  consumed: number;
  received: number;
  maxSeen: number;
}

export interface QueuedValue {
  value: Value | Pulse;
  creditsNeeded: number;
  timestamp: number;
  resolve?: (value: Value | Pulse) => void;
  reject?: (error: Error) => void;
}

export interface CreditGateState {
  credits: CreditState;
  queue: QueuedValue[];
  stats: {
    passed: number;
    dropped: number;
    queued: number;
    demandSignaled: number;
  };
}

// ============================================================================
// Credit Gate Gadget Implementation
// ============================================================================

export class CreditGateGadget {
  private readonly id: GadgetId;
  private readonly config: CreditGateConfig;
  private readonly state: CreditGateState;
  private demandCallback?: (needed: number) => void;
  
  constructor(id: string, config: Partial<CreditGateConfig> = {}) {
    this.id = createGadgetId(id);
    this.config = CreditGateConfig.parse(config);
    
    this.state = {
      credits: {
        available: this.config.initialCredits,
        consumed: 0,
        received: this.config.initialCredits,
        maxSeen: this.config.initialCredits
      },
      queue: [],
      stats: {
        passed: 0,
        dropped: 0,
        queued: 0,
        demandSignaled: 0
      }
    };
  }
  
  /**
   * Process a value/pulse through the gate
   */
  async process(input: Value | Pulse): Promise<Value | Pulse | null> {
    const creditsNeeded = this.config.creditsPerItem;
    
    // Try to consume credits
    if (this.tryConsume(creditsNeeded)) {
      this.state.stats.passed++;
      this.processQueue(); // Try to process queued items
      return input; // Pass through
    }
    
    // Handle insufficient credits
    switch (this.config.onNoCredits) {
      case 'queue':
        return this.enqueue(input, creditsNeeded);
        
      case 'drop':
        this.state.stats.dropped++;
        this.signalDemand(creditsNeeded);
        return null;
        
      case 'error':
        throw new Error(`Insufficient credits: need ${creditsNeeded}, have ${this.state.credits.available}`);
        
      default:
        return null;
    }
  }
  
  /**
   * Receive credits from scheduler
   */
  receiveCredits(amount: number): void {
    if (amount <= 0) return;
    
    const newTotal = this.state.credits.available + amount;
    this.state.credits.available = Math.min(newTotal, this.config.maxCredits);
    this.state.credits.received += amount;
    this.state.credits.maxSeen = Math.max(this.state.credits.maxSeen, this.state.credits.available);
    
    // Process waiting queue
    this.processQueue();
  }
  
  /**
   * Try to consume credits
   */
  private tryConsume(amount: number): boolean {
    if (this.state.credits.available >= amount) {
      this.state.credits.available -= amount;
      this.state.credits.consumed += amount;
      return true;
    }
    return false;
  }
  
  /**
   * Enqueue a value for later processing
   */
  private async enqueue(
    input: Value | Pulse, 
    creditsNeeded: number
  ): Promise<Value | Pulse | null> {
    const queueConfig = this.config.queue || { maxSize: 100, fifo: true };
    
    // Check queue size
    if (this.state.queue.length >= queueConfig.maxSize) {
      this.state.stats.dropped++;
      return null;
    }
    
    // Signal demand
    this.signalDemand(creditsNeeded);
    
    // Create promise for async queuing
    return new Promise((resolve, reject) => {
      const item: QueuedValue = {
        value: input,
        creditsNeeded,
        timestamp: Date.now(),
        resolve,
        reject
      };
      
      if (queueConfig.fifo) {
        this.state.queue.push(item); // FIFO - add to end
      } else {
        this.state.queue.unshift(item); // LIFO - add to beginning
      }
      
      this.state.stats.queued++;
    });
  }
  
  /**
   * Process queued items when credits available
   */
  private processQueue(): void {
    while (this.state.queue.length > 0) {
      const item = this.state.queue[0];
      
      if (this.tryConsume(item.creditsNeeded)) {
        this.state.queue.shift();
        this.state.stats.passed++;
        this.state.stats.queued--;
        
        if (item.resolve) {
          item.resolve(item.value);
        }
      } else {
        // Not enough credits for next item
        break;
      }
    }
  }
  
  /**
   * Signal demand for more credits
   */
  private signalDemand(needed: number): void {
    if (!this.config.autoDemand) return;
    
    this.state.stats.demandSignaled++;
    
    // Calculate total demand (current need + queue)
    const queueDemand = this.state.queue.reduce(
      (sum, item) => sum + item.creditsNeeded, 
      0
    );
    const totalDemand = needed + queueDemand;
    
    // Emit demand signal
    if (this.demandCallback) {
      this.demandCallback(totalDemand);
    }
  }
  
  /**
   * Set demand callback
   */
  onDemand(callback: (needed: number) => void): void {
    this.demandCallback = callback;
  }
  
  /**
   * Get current statistics
   */
  getStats(): {
    credits: {
      available: number;
      consumed: number;
      received: number;
    };
    queue: {
      size: number;
      totalCreditsNeeded: number;
    };
    throughput: {
      passed: number;
      dropped: number;
      queued: number;
    };
    demand: {
      signaled: number;
    };
  } {
    const queueCredits = this.state.queue.reduce(
      (sum, item) => sum + item.creditsNeeded,
      0
    );
    
    return {
      credits: {
        available: this.state.credits.available,
        consumed: this.state.credits.consumed,
        received: this.state.credits.received
      },
      queue: {
        size: this.state.queue.length,
        totalCreditsNeeded: queueCredits
      },
      throughput: {
        passed: this.state.stats.passed,
        dropped: this.state.stats.dropped,
        queued: this.state.stats.queued
      },
      demand: {
        signaled: this.state.stats.demandSignaled
      }
    };
  }
  
  /**
   * Reset gate to initial state
   */
  reset(): void {
    // Reject all queued items
    for (const item of this.state.queue) {
      if (item.reject) {
        item.reject(new Error('Credit gate reset'));
      }
    }
    
    // Reset state
    this.state.credits = {
      available: this.config.initialCredits,
      consumed: 0,
      received: this.config.initialCredits,
      maxSeen: this.config.initialCredits
    };
    this.state.queue = [];
    this.state.stats = {
      passed: 0,
      dropped: 0,
      queued: 0,
      demandSignaled: 0
    };
  }
  
  /**
   * Destroy and cleanup
   */
  destroy(): void {
    // Reject all queued items
    for (const item of this.state.queue) {
      if (item.reject) {
        item.reject(new Error('Credit gate destroyed'));
      }
    }
    this.state.queue = [];
    this.demandCallback = undefined;
  }
}

// ============================================================================
// Credit Gate Gadget Specification
// ============================================================================

/**
 * Create a credit gate gadget spec
 */
export function createCreditGateGadgetSpec(config?: Partial<CreditGateConfig>): GadgetSpec {
  return {
    pinouts: [createPinoutId('credit-gate-io')],
    params: {
      type: 'credit-gate',
      config: config || {}
    },
    traits: [
      {
        trait: 'bounded-memory',
        confidence: 3,
        evidence: [{
          kind: 'declared',
          by: 'stdlib',
          at: new Date().toISOString()
        }]
      },
      {
        trait: 'sched:deterministic',
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
// Credit Gate Pinout Definition
// ============================================================================

/**
 * Get the credit gate pinout
 */
export function getCreditGatePinout() {
  return {
    id: createPinoutId('credit-gate-io'),
    pins: {
      'in': {
        kind: 'ValueIn' as const,
        required: true
      },
      'out': {
        kind: 'ValueOut' as const,
        required: true
      },
      'credits': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'scheduler',
        lattice: 'MaxInt'
      },
      'demand': {
        kind: 'EventOut' as const,
        required: false,
        domain: 'scheduler'
      },
      'stats': {
        kind: 'ValueOut' as const,
        required: false,
        domain: 'metrics'
      }
    }
  };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a credit gate gadget instance
 */
export function createCreditGateGadget(
  id: string = 'credit-gate',
  config?: Partial<CreditGateConfig>
): CreditGateGadget {
  return new CreditGateGadget(id, config);
}