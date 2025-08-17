/**
 * Math Primitive Gadgets
 * Pure, deterministic mathematical operations
 */

import { z } from 'zod';
import { 
  GadgetSpec, GadgetId, PinoutId, Value,
  createGadgetId, createPinoutId 
} from '../../core/types';

// ============================================================================
// Math Operation Types
// ============================================================================

export type BinaryOp = 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power';
export type UnaryOp = 'negate' | 'abs' | 'sqrt' | 'floor' | 'ceil' | 'round';
export type CompareOp = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';

// ============================================================================
// Math Gadget Base Class
// ============================================================================

export abstract class MathGadget {
  protected readonly id: GadgetId;
  protected readonly operation: string;
  
  constructor(id: string, operation: string) {
    this.id = createGadgetId(id);
    this.operation = operation;
  }
  
  /**
   * Convert value to number, with fallback
   */
  protected toNumber(value: Value, fallback: number = 0): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? fallback : parsed;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return fallback;
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
// Binary Math Gadget
// ============================================================================

export class BinaryMathGadget extends MathGadget {
  private readonly op: BinaryOp;
  
  constructor(id: string, op: BinaryOp) {
    super(id, op);
    this.op = op;
  }
  
  process(inputs: Record<string, Value>): Value {
    const a = this.toNumber(inputs.a);
    const b = this.toNumber(inputs.b);
    
    switch (this.op) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return b !== 0 ? a / b : NaN;
      case 'modulo': return b !== 0 ? a % b : NaN;
      case 'power': return Math.pow(a, b);
      default: return NaN;
    }
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('binary-math')],
      params: {
        type: 'binary-math',
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
// Unary Math Gadget
// ============================================================================

export class UnaryMathGadget extends MathGadget {
  private readonly op: UnaryOp;
  
  constructor(id: string, op: UnaryOp) {
    super(id, op);
    this.op = op;
  }
  
  process(inputs: Record<string, Value>): Value {
    const value = this.toNumber(inputs.value);
    
    switch (this.op) {
      case 'negate': return -value;
      case 'abs': return Math.abs(value);
      case 'sqrt': return Math.sqrt(value);
      case 'floor': return Math.floor(value);
      case 'ceil': return Math.ceil(value);
      case 'round': return Math.round(value);
      default: return NaN;
    }
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('unary-math')],
      params: {
        type: 'unary-math',
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
// Comparison Gadget
// ============================================================================

export class ComparisonGadget extends MathGadget {
  private readonly op: CompareOp;
  
  constructor(id: string, op: CompareOp) {
    super(id, op);
    this.op = op;
  }
  
  process(inputs: Record<string, Value>): Value {
    const a = this.toNumber(inputs.a);
    const b = this.toNumber(inputs.b);
    
    switch (this.op) {
      case 'eq': return a === b;
      case 'neq': return a !== b;
      case 'lt': return a < b;
      case 'lte': return a <= b;
      case 'gt': return a > b;
      case 'gte': return a >= b;
      default: return false;
    }
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('comparison')],
      params: {
        type: 'comparison',
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
// Accumulator Gadget (Stateful)
// ============================================================================

export class AccumulatorGadget extends MathGadget {
  private state: number = 0;
  private readonly op: 'sum' | 'product' | 'min' | 'max' | 'count';
  
  constructor(id: string, op: 'sum' | 'product' | 'min' | 'max' | 'count') {
    super(id, op);
    this.op = op;
    
    // Initialize state based on operation
    switch (op) {
      case 'sum': this.state = 0; break;
      case 'product': this.state = 1; break;
      case 'min': this.state = Infinity; break;
      case 'max': this.state = -Infinity; break;
      case 'count': this.state = 0; break;
    }
  }
  
  process(inputs: Record<string, Value>): Value {
    const value = this.toNumber(inputs.value);
    const reset = inputs.reset;
    
    // Handle reset signal
    if (reset) {
      switch (this.op) {
        case 'sum': this.state = 0; break;
        case 'product': this.state = 1; break;
        case 'min': this.state = Infinity; break;
        case 'max': this.state = -Infinity; break;
        case 'count': this.state = 0; break;
      }
      return this.state;
    }
    
    // Update state based on operation
    switch (this.op) {
      case 'sum': 
        this.state += value;
        break;
      case 'product': 
        this.state *= value;
        break;
      case 'min': 
        this.state = Math.min(this.state, value);
        break;
      case 'max': 
        this.state = Math.max(this.state, value);
        break;
      case 'count': 
        this.state += 1;
        break;
    }
    
    return this.state;
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('accumulator')],
      params: {
        type: 'accumulator',
        operation: this.op
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
  getState(): number {
    return this.state;
  }
  
  /**
   * Reset to initial state
   */
  reset(): void {
    switch (this.op) {
      case 'sum': this.state = 0; break;
      case 'product': this.state = 1; break;
      case 'min': this.state = Infinity; break;
      case 'max': this.state = -Infinity; break;
      case 'count': this.state = 0; break;
    }
  }
}

// ============================================================================
// Pinout Definitions
// ============================================================================

export function getBinaryMathPinout() {
  return {
    id: createPinoutId('binary-math'),
    pins: {
      'a': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'number'
      },
      'b': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'number'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'number'
      }
    }
  };
}

export function getUnaryMathPinout() {
  return {
    id: createPinoutId('unary-math'),
    pins: {
      'value': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'number'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'number'
      }
    }
  };
}

export function getComparisonPinout() {
  return {
    id: createPinoutId('comparison'),
    pins: {
      'a': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'number'
      },
      'b': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'number'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'boolean'
      }
    }
  };
}

export function getAccumulatorPinout() {
  return {
    id: createPinoutId('accumulator'),
    pins: {
      'value': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'number'
      },
      'reset': {
        kind: 'PulseIn' as const,
        required: false
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'number'
      },
      'state': {
        kind: 'ValueOut' as const,
        required: false,
        domain: 'number'
      }
    }
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAddGadget(id: string = 'add'): BinaryMathGadget {
  return new BinaryMathGadget(id, 'add');
}

export function createSubtractGadget(id: string = 'subtract'): BinaryMathGadget {
  return new BinaryMathGadget(id, 'subtract');
}

export function createMultiplyGadget(id: string = 'multiply'): BinaryMathGadget {
  return new BinaryMathGadget(id, 'multiply');
}

export function createDivideGadget(id: string = 'divide'): BinaryMathGadget {
  return new BinaryMathGadget(id, 'divide');
}

export function createNegateGadget(id: string = 'negate'): UnaryMathGadget {
  return new UnaryMathGadget(id, 'negate');
}

export function createAbsGadget(id: string = 'abs'): UnaryMathGadget {
  return new UnaryMathGadget(id, 'abs');
}

export function createEqualGadget(id: string = 'equal'): ComparisonGadget {
  return new ComparisonGadget(id, 'eq');
}

export function createLessThanGadget(id: string = 'less-than'): ComparisonGadget {
  return new ComparisonGadget(id, 'lt');
}

export function createSumGadget(id: string = 'sum'): AccumulatorGadget {
  return new AccumulatorGadget(id, 'sum');
}

export function createMaxGadget(id: string = 'max'): AccumulatorGadget {
  return new AccumulatorGadget(id, 'max');
}