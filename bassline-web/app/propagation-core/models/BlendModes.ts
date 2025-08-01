import type { BlendMode } from './types';

/**
 * Accept the last (most recent) value - the default merge strategy
 */
export class AcceptLastValue implements BlendMode {
  name = 'AcceptLastValue';
  
  blend(existing: any, incoming: any): any {
    return incoming;
  }
}

/**
 * Keep the first value - ignore updates
 */
export class KeepFirstValue implements BlendMode {
  name = 'KeepFirstValue';
  
  blend(existing: any, incoming: any): any {
    return existing;
  }
}

// That's it - arithmetic operations should be done by gadgets, not blend modes