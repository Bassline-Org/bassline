/**
 * Rate Limit Shim - Token bucket rate limiting for propagation
 * Composes via lattice (taking minimum/most restrictive)
 */

import { z } from 'zod';
import { 
  GadgetSpec, GadgetId, PinoutId, Pulse, Value,
  createGadgetId, createPinoutId 
} from '../../core/types';
import { RateLimitLattice, type RateLimit } from '../../core/lattice';

// ============================================================================
// Rate Limit Configuration
// ============================================================================

export const RateLimitConfig = z.object({
  // Rate limit parameters
  rps: z.number().positive().describe('Requests per second'),
  burst: z.number().positive().optional().describe('Burst capacity'),
  
  // Behavior on limit
  onLimit: z.enum(['drop', 'queue', 'error']).default('drop'),
  
  // Queue settings (if onLimit = 'queue')
  queue: z.object({
    maxSize: z.number().positive().default(100),
    timeout: z.number().positive().optional().describe('Queue timeout in ms')
  }).optional(),
  
  // Backpressure signal
  emitBackpressure: z.boolean().default(false)
});

export type RateLimitConfig = z.infer<typeof RateLimitConfig>;

// ============================================================================
// Token Bucket State
// ============================================================================

export interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRate: number;
  lastRefill: number;
}

export interface QueuedItem {
  value: Value | Pulse;
  timestamp: number;
  resolve?: (value: Value | Pulse) => void;
  reject?: (error: Error) => void;
}

export interface RateLimitState {
  bucket: TokenBucket;
  queue: QueuedItem[];
  dropped: number;
  passed: number;
  queued: number;
}

// ============================================================================
// Rate Limit Gadget Implementation
// ============================================================================

export class RateLimitGadget {
  private readonly id: GadgetId;
  private config: RateLimitConfig;
  private readonly state: RateLimitState;
  private processTimer?: NodeJS.Timeout;
  
  constructor(id: string, config: Partial<RateLimitConfig> = {}) {
    this.id = createGadgetId(id);
    this.config = RateLimitConfig.parse(config);
    
    // Initialize token bucket
    const capacity = config.burst || Math.ceil(this.config.rps);
    this.state = {
      bucket: {
        tokens: capacity,
        capacity,
        refillRate: this.config.rps,
        lastRefill: Date.now()
      },
      queue: [],
      dropped: 0,
      passed: 0,
      queued: 0
    };
    
    // Start queue processor if needed
    if (this.config.onLimit === 'queue') {
      this.startQueueProcessor();
    }
  }
  
  /**
   * Process a value/pulse with rate limiting
   */
  async process(input: Value | Pulse): Promise<Value | Pulse | null> {
    // Refill tokens based on elapsed time
    this.refillTokens();
    
    // Try to consume a token
    if (this.consumeToken()) {
      this.state.passed++;
      return input; // Pass through
    }
    
    // Handle rate limit exceeded
    switch (this.config.onLimit) {
      case 'drop':
        this.state.dropped++;
        if (this.config.emitBackpressure) {
          this.emitBackpressure();
        }
        return null; // Drop the value
        
      case 'queue':
        return this.enqueue(input);
        
      case 'error':
        throw new Error('Rate limit exceeded');
        
      default:
        return null;
    }
  }
  
  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.state.bucket.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = elapsed * this.state.bucket.refillRate;
    
    if (tokensToAdd > 0) {
      this.state.bucket.tokens = Math.min(
        this.state.bucket.capacity,
        this.state.bucket.tokens + tokensToAdd
      );
      this.state.bucket.lastRefill = now;
    }
  }
  
  /**
   * Try to consume a token
   */
  private consumeToken(): boolean {
    if (this.state.bucket.tokens >= 1) {
      this.state.bucket.tokens--;
      return true;
    }
    return false;
  }
  
  /**
   * Enqueue a value for later processing
   */
  private async enqueue(input: Value | Pulse): Promise<Value | Pulse | null> {
    const queueConfig = this.config.queue || { maxSize: 100 };
    
    // Check queue size
    if (this.state.queue.length >= queueConfig.maxSize) {
      this.state.dropped++;
      return null; // Drop if queue full
    }
    
    // Create promise for async queuing
    return new Promise((resolve, reject) => {
      const item: QueuedItem = {
        value: input,
        timestamp: Date.now(),
        resolve,
        reject
      };
      
      this.state.queue.push(item);
      this.state.queued++;
      
      // Set timeout if configured
      if (queueConfig.timeout) {
        setTimeout(() => {
          const index = this.state.queue.indexOf(item);
          if (index >= 0) {
            this.state.queue.splice(index, 1);
            reject(new Error('Queue timeout'));
          }
        }, queueConfig.timeout);
      }
    });
  }
  
  /**
   * Process queued items
   */
  private startQueueProcessor(): void {
    const processQueue = () => {
      this.refillTokens();
      
      while (this.state.queue.length > 0 && this.consumeToken()) {
        const item = this.state.queue.shift();
        if (item?.resolve) {
          this.state.passed++;
          this.state.queued--;
          item.resolve(item.value);
        }
      }
    };
    
    // Process queue every 100ms
    this.processTimer = setInterval(processQueue, 100);
  }
  
  /**
   * Emit backpressure signal
   */
  private emitBackpressure(): void {
    // This would emit to a backpressure pin
    // Implementation depends on runtime integration
  }
  
  /**
   * Compose with another rate limit via lattice
   */
  compose(other: RateLimitConfig): void {
    const thisLimit: RateLimit = {
      rps: this.config.rps,
      burst: this.config.burst
    };
    
    const otherLimit: RateLimit = {
      rps: other.rps,
      burst: other.burst
    };
    
    // Use lattice to compose (takes minimum/most restrictive)
    const composed = RateLimitLattice.join(thisLimit, otherLimit);
    
    if (composed) {
      this.config.rps = composed.rps;
      this.config.burst = composed.burst;
      
      // Update bucket
      this.state.bucket.refillRate = composed.rps;
      this.state.bucket.capacity = composed.burst || Math.ceil(composed.rps);
    }
  }
  
  /**
   * Get current statistics
   */
  getStats(): {
    passed: number;
    dropped: number;
    queued: number;
    queueSize: number;
    tokensAvailable: number;
    config: { rps: number; burst?: number };
  } {
    return {
      passed: this.state.passed,
      dropped: this.state.dropped,
      queued: this.state.queued,
      queueSize: this.state.queue.length,
      tokensAvailable: Math.floor(this.state.bucket.tokens),
      config: {
        rps: this.config.rps,
        burst: this.config.burst
      }
    };
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = undefined;
    }
    
    // Reject all queued items
    for (const item of this.state.queue) {
      if (item.reject) {
        item.reject(new Error('Rate limiter destroyed'));
      }
    }
    this.state.queue = [];
  }
}

// ============================================================================
// Rate Limit Gadget Specification
// ============================================================================

/**
 * Create a rate limit gadget spec
 */
export function createRateLimitGadgetSpec(config?: Partial<RateLimitConfig>): GadgetSpec {
  return {
    pinouts: [createPinoutId('rate-limit-io')],
    params: {
      type: 'rate-limit',
      config: config || { rps: 10 }
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
      }
    ]
  };
}

// ============================================================================
// Rate Limit Pinout Definition
// ============================================================================

/**
 * Get the rate limit pinout
 */
export function getRateLimitPinout() {
  return {
    id: createPinoutId('rate-limit-io'),
    pins: {
      'in': {
        kind: 'ValueIn' as const,
        required: true,
        lattice: 'RateLimit'
      },
      'out': {
        kind: 'ValueOut' as const,
        required: true
      },
      'backpressure': {
        kind: 'EventOut' as const,
        required: false,
        domain: 'control'
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
 * Create a rate limit gadget instance
 */
export function createRateLimitGadget(
  id: string = 'rate-limit',
  config?: Partial<RateLimitConfig>
): RateLimitGadget {
  return new RateLimitGadget(id, config);
}

// ============================================================================
// RateLimit Aspect Manifest
// ============================================================================

import { AspectManifest } from '../../runtime/aspects';
import { brand } from '../../core/types';
import { RateLimitLattice } from '../../core/lattice';

export const RateLimitAspect: AspectManifest = {
  id: brand.aspectId('aspect://rate-limit@1'),
  name: 'RateLimit',
  version: 1,
  targets: ['wire', 'slot'],
  at: 'tapIn',
  orderKey: 200,
  compose: RateLimitLattice,
  shimTemplate: brand.gadgetId('gadget://rate-limit'),
  schema: (params: unknown) => RateLimitConfig.parse(params),
  description: 'Rate limiting with token bucket algorithm',
  author: 'stdlib'
};