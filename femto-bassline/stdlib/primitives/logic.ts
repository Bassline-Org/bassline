/**
 * Logic Primitive Gadgets
 * Boolean operations and logical control flow
 */

import { z } from 'zod';
import { 
  GadgetSpec, GadgetId, Value,
  createGadgetId, createPinoutId 
} from '../../core/types';

// ============================================================================
// Logic Operation Types
// ============================================================================

export type BinaryLogicOp = 'and' | 'or' | 'xor' | 'nand' | 'nor' | 'xnor';
export type UnaryLogicOp = 'not' | 'identity';

// ============================================================================
// Logic Gadget Base Class
// ============================================================================

export abstract class LogicGadget {
  protected readonly id: GadgetId;
  protected readonly operation: string;
  
  constructor(id: string, operation: string) {
    this.id = createGadgetId(id);
    this.operation = operation;
  }
  
  /**
   * Convert value to boolean
   */
  protected toBool(value: Value): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (value === null || value === undefined) return false;
    return true;
  }
  
  /**
   * Process inputs and return output
   */
  abstract process(inputs: Record<string, Value>): Value;
  
  /**
   * Get gadget specification
   */
  abstract getSpec(): GadgetSpec;
}

// ============================================================================
// Binary Logic Gadget
// ============================================================================

export class BinaryLogicGadget extends LogicGadget {
  private readonly op: BinaryLogicOp;
  
  constructor(id: string, op: BinaryLogicOp) {
    super(id, op);
    this.op = op;
  }
  
  process(inputs: Record<string, Value>): Value {
    const a = this.toBool(inputs.a);
    const b = this.toBool(inputs.b);
    
    switch (this.op) {
      case 'and': return a && b;
      case 'or': return a || b;
      case 'xor': return a !== b;
      case 'nand': return !(a && b);
      case 'nor': return !(a || b);
      case 'xnor': return a === b;
      default: return false;
    }
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('binary-logic')],
      params: {
        type: 'binary-logic',
        operation: this.op
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
}

// ============================================================================
// Unary Logic Gadget
// ============================================================================

export class UnaryLogicGadget extends LogicGadget {
  private readonly op: UnaryLogicOp;
  
  constructor(id: string, op: UnaryLogicOp) {
    super(id, op);
    this.op = op;
  }
  
  process(inputs: Record<string, Value>): Value {
    const value = this.toBool(inputs.value);
    
    switch (this.op) {
      case 'not': return !value;
      case 'identity': return value;
      default: return false;
    }
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('unary-logic')],
      params: {
        type: 'unary-logic',
        operation: this.op
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
}

// ============================================================================
// Conditional Gadget (Ternary/Mux)
// ============================================================================

export class ConditionalGadget extends LogicGadget {
  constructor(id: string) {
    super(id, 'conditional');
  }
  
  process(inputs: Record<string, Value>): Value {
    const condition = this.toBool(inputs.condition);
    return condition ? inputs.whenTrue : inputs.whenFalse;
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('conditional')],
      params: {
        type: 'conditional'
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
}

// ============================================================================
// Latch Gadget (Stateful)
// ============================================================================

export class LatchGadget extends LogicGadget {
  private state: boolean = false;
  private readonly type: 'sr' | 'd' | 'jk' | 't';
  
  constructor(id: string, type: 'sr' | 'd' | 'jk' | 't' = 'd') {
    super(id, `${type}-latch`);
    this.type = type;
  }
  
  process(inputs: Record<string, Value>): Value {
    switch (this.type) {
      case 'sr': {
        // Set-Reset latch
        const set = this.toBool(inputs.set);
        const reset = this.toBool(inputs.reset);
        
        if (set && !reset) {
          this.state = true;
        } else if (!set && reset) {
          this.state = false;
        }
        // If both or neither, maintain state
        break;
      }
      
      case 'd': {
        // Data latch
        const enable = this.toBool(inputs.enable);
        if (enable) {
          this.state = this.toBool(inputs.data);
        }
        break;
      }
      
      case 'jk': {
        // JK flip-flop
        const j = this.toBool(inputs.j);
        const k = this.toBool(inputs.k);
        const clock = this.toBool(inputs.clock);
        
        if (clock) {
          if (j && !k) {
            this.state = true;
          } else if (!j && k) {
            this.state = false;
          } else if (j && k) {
            this.state = !this.state; // Toggle
          }
        }
        break;
      }
      
      case 't': {
        // Toggle flip-flop
        const toggle = this.toBool(inputs.toggle);
        const clock = this.toBool(inputs.clock);
        
        if (clock && toggle) {
          this.state = !this.state;
        }
        break;
      }
    }
    
    return this.state;
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId(`${this.type}-latch`)],
      params: {
        type: 'latch',
        latchType: this.type
      },
      traits: [
        {
          trait: 'deterministic',
          confidence: 3,
          evidence: [{
            kind: 'declared',
            by: 'stdlib',
            at: new Date().toISOString()
          }]
        }
        // Note: Not pure due to internal state
      ]
    };
  }
  
  /**
   * Get current state
   */
  getState(): boolean {
    return this.state;
  }
  
  /**
   * Reset to initial state
   */
  reset(): void {
    this.state = false;
  }
}

// ============================================================================
// Pinout Definitions
// ============================================================================

export function getBinaryLogicPinout() {
  return {
    id: createPinoutId('binary-logic'),
    pins: {
      'a': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'boolean'
      },
      'b': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'boolean'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'boolean'
      }
    }
  };
}

export function getUnaryLogicPinout() {
  return {
    id: createPinoutId('unary-logic'),
    pins: {
      'value': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'boolean'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'boolean'
      }
    }
  };
}

export function getConditionalPinout() {
  return {
    id: createPinoutId('conditional'),
    pins: {
      'condition': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'boolean'
      },
      'whenTrue': {
        kind: 'ValueIn' as const,
        required: true
      },
      'whenFalse': {
        kind: 'ValueIn' as const,
        required: true
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true
      }
    }
  };
}

export function getSRLatchPinout() {
  return {
    id: createPinoutId('sr-latch'),
    pins: {
      'set': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'boolean'
      },
      'reset': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'boolean'
      },
      'q': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'boolean'
      },
      'qBar': {
        kind: 'ValueOut' as const,
        required: false,
        domain: 'boolean'
      }
    }
  };
}

export function getDLatchPinout() {
  return {
    id: createPinoutId('d-latch'),
    pins: {
      'data': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'boolean'
      },
      'enable': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'boolean'
      },
      'q': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'boolean'
      }
    }
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAndGadget(id: string = 'and'): BinaryLogicGadget {
  return new BinaryLogicGadget(id, 'and');
}

export function createOrGadget(id: string = 'or'): BinaryLogicGadget {
  return new BinaryLogicGadget(id, 'or');
}

export function createXorGadget(id: string = 'xor'): BinaryLogicGadget {
  return new BinaryLogicGadget(id, 'xor');
}

export function createNandGadget(id: string = 'nand'): BinaryLogicGadget {
  return new BinaryLogicGadget(id, 'nand');
}

export function createNorGadget(id: string = 'nor'): BinaryLogicGadget {
  return new BinaryLogicGadget(id, 'nor');
}

export function createNotGadget(id: string = 'not'): UnaryLogicGadget {
  return new UnaryLogicGadget(id, 'not');
}

export function createConditionalGadget(id: string = 'cond'): ConditionalGadget {
  return new ConditionalGadget(id);
}

export function createSRLatchGadget(id: string = 'sr-latch'): LatchGadget {
  return new LatchGadget(id, 'sr');
}

export function createDLatchGadget(id: string = 'd-latch'): LatchGadget {
  return new LatchGadget(id, 'd');
}

export function createJKLatchGadget(id: string = 'jk-latch'): LatchGadget {
  return new LatchGadget(id, 'jk');
}

export function createTLatchGadget(id: string = 't-latch'): LatchGadget {
  return new LatchGadget(id, 't');
}