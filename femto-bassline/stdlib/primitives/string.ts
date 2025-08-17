/**
 * String Primitive Gadgets
 * Text manipulation and string operations
 */

import { z } from 'zod';
import { 
  GadgetSpec, GadgetId, Value,
  createGadgetId, createPinoutId 
} from '../../core/types';

// ============================================================================
// String Operation Types
// ============================================================================

export type StringTransformOp = 'uppercase' | 'lowercase' | 'trim' | 'reverse' | 'capitalize';
export type StringExtractOp = 'substring' | 'charAt' | 'indexOf' | 'lastIndexOf';
export type StringTestOp = 'startsWith' | 'endsWith' | 'includes' | 'matches';

// ============================================================================
// String Gadget Base Class
// ============================================================================

export abstract class StringGadget {
  protected readonly id: GadgetId;
  protected readonly operation: string;
  
  constructor(id: string, operation: string) {
    this.id = createGadgetId(id);
    this.operation = operation;
  }
  
  /**
   * Convert value to string
   */
  protected toString(value: Value): string {
    if (typeof value === 'string') return value;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    return String(value);
  }
  
  /**
   * Convert value to number with fallback
   */
  protected toNumber(value: Value, fallback: number = 0): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? fallback : parsed;
    }
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
// String Concatenation Gadget
// ============================================================================

export class ConcatGadget extends StringGadget {
  private readonly separator: string;
  
  constructor(id: string, separator: string = '') {
    super(id, 'concat');
    this.separator = separator;
  }
  
  process(inputs: Record<string, Value>): Value {
    const a = this.toString(inputs.a);
    const b = this.toString(inputs.b);
    return a + this.separator + b;
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('string-concat')],
      params: {
        type: 'string-concat',
        separator: this.separator
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
// String Transform Gadget
// ============================================================================

export class StringTransformGadget extends StringGadget {
  private readonly op: StringTransformOp;
  
  constructor(id: string, op: StringTransformOp) {
    super(id, op);
    this.op = op;
  }
  
  process(inputs: Record<string, Value>): Value {
    const str = this.toString(inputs.value);
    
    switch (this.op) {
      case 'uppercase': 
        return str.toUpperCase();
      
      case 'lowercase': 
        return str.toLowerCase();
      
      case 'trim': 
        return str.trim();
      
      case 'reverse': 
        return str.split('').reverse().join('');
      
      case 'capitalize': 
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      
      default: 
        return str;
    }
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('string-transform')],
      params: {
        type: 'string-transform',
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
// String Extract Gadget
// ============================================================================

export class StringExtractGadget extends StringGadget {
  private readonly op: StringExtractOp;
  
  constructor(id: string, op: StringExtractOp) {
    super(id, op);
    this.op = op;
  }
  
  process(inputs: Record<string, Value>): Value {
    const str = this.toString(inputs.value);
    
    switch (this.op) {
      case 'substring': {
        const start = this.toNumber(inputs.start, 0);
        const end = inputs.end !== undefined ? 
          this.toNumber(inputs.end) : str.length;
        return str.substring(start, end);
      }
      
      case 'charAt': {
        const index = this.toNumber(inputs.index, 0);
        return str.charAt(index);
      }
      
      case 'indexOf': {
        const search = this.toString(inputs.search);
        const from = inputs.from !== undefined ? 
          this.toNumber(inputs.from, 0) : 0;
        return str.indexOf(search, from);
      }
      
      case 'lastIndexOf': {
        const search = this.toString(inputs.search);
        const from = inputs.from !== undefined ? 
          this.toNumber(inputs.from) : undefined;
        return str.lastIndexOf(search, from);
      }
      
      default: 
        return '';
    }
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId(`string-${this.op}`)],
      params: {
        type: 'string-extract',
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
// String Test Gadget
// ============================================================================

export class StringTestGadget extends StringGadget {
  private readonly op: StringTestOp;
  
  constructor(id: string, op: StringTestOp) {
    super(id, op);
    this.op = op;
  }
  
  process(inputs: Record<string, Value>): Value {
    const str = this.toString(inputs.value);
    const pattern = this.toString(inputs.pattern);
    
    switch (this.op) {
      case 'startsWith': 
        return str.startsWith(pattern);
      
      case 'endsWith': 
        return str.endsWith(pattern);
      
      case 'includes': 
        return str.includes(pattern);
      
      case 'matches': {
        try {
          const regex = new RegExp(pattern);
          return regex.test(str);
        } catch {
          return false;
        }
      }
      
      default: 
        return false;
    }
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('string-test')],
      params: {
        type: 'string-test',
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
// String Split/Join Gadget
// ============================================================================

export class StringSplitGadget extends StringGadget {
  constructor(id: string) {
    super(id, 'split');
  }
  
  process(inputs: Record<string, Value>): Value {
    const str = this.toString(inputs.value);
    const delimiter = inputs.delimiter !== undefined ? 
      this.toString(inputs.delimiter) : ',';
    const limit = inputs.limit !== undefined ? 
      this.toNumber(inputs.limit) : undefined;
    
    return str.split(delimiter, limit);
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('string-split')],
      params: {
        type: 'string-split'
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

export class StringJoinGadget extends StringGadget {
  constructor(id: string) {
    super(id, 'join');
  }
  
  process(inputs: Record<string, Value>): Value {
    const array = inputs.array;
    const separator = inputs.separator !== undefined ? 
      this.toString(inputs.separator) : ',';
    
    if (!Array.isArray(array)) {
      return this.toString(array);
    }
    
    return array.map(v => this.toString(v)).join(separator);
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('string-join')],
      params: {
        type: 'string-join'
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
// String Template Gadget
// ============================================================================

export class StringTemplateGadget extends StringGadget {
  private readonly template: string;
  
  constructor(id: string, template: string) {
    super(id, 'template');
    this.template = template;
  }
  
  process(inputs: Record<string, Value>): Value {
    let result = this.template;
    
    // Replace {{key}} with value from inputs
    for (const [key, value] of Object.entries(inputs)) {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(pattern, this.toString(value));
    }
    
    return result;
  }
  
  getSpec(): GadgetSpec {
    return {
      pinouts: [createPinoutId('string-template')],
      params: {
        type: 'string-template',
        template: this.template
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
// Pinout Definitions
// ============================================================================

export function getStringConcatPinout() {
  return {
    id: createPinoutId('string-concat'),
    pins: {
      'a': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'string'
      },
      'b': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'string'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'string'
      }
    }
  };
}

export function getStringTransformPinout() {
  return {
    id: createPinoutId('string-transform'),
    pins: {
      'value': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'string'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'string'
      }
    }
  };
}

export function getStringTestPinout() {
  return {
    id: createPinoutId('string-test'),
    pins: {
      'value': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'string'
      },
      'pattern': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'string'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'boolean'
      }
    }
  };
}

export function getStringSplitPinout() {
  return {
    id: createPinoutId('string-split'),
    pins: {
      'value': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'string'
      },
      'delimiter': {
        kind: 'ValueIn' as const,
        required: false,
        domain: 'string'
      },
      'limit': {
        kind: 'ValueIn' as const,
        required: false,
        domain: 'number'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'array'
      }
    }
  };
}

export function getStringJoinPinout() {
  return {
    id: createPinoutId('string-join'),
    pins: {
      'array': {
        kind: 'ValueIn' as const,
        required: true,
        domain: 'array'
      },
      'separator': {
        kind: 'ValueIn' as const,
        required: false,
        domain: 'string'
      },
      'result': {
        kind: 'ValueOut' as const,
        required: true,
        domain: 'string'
      }
    }
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createConcatGadget(id: string = 'concat', separator: string = ''): ConcatGadget {
  return new ConcatGadget(id, separator);
}

export function createUppercaseGadget(id: string = 'uppercase'): StringTransformGadget {
  return new StringTransformGadget(id, 'uppercase');
}

export function createLowercaseGadget(id: string = 'lowercase'): StringTransformGadget {
  return new StringTransformGadget(id, 'lowercase');
}

export function createTrimGadget(id: string = 'trim'): StringTransformGadget {
  return new StringTransformGadget(id, 'trim');
}

export function createReverseGadget(id: string = 'reverse'): StringTransformGadget {
  return new StringTransformGadget(id, 'reverse');
}

export function createCapitalizeGadget(id: string = 'capitalize'): StringTransformGadget {
  return new StringTransformGadget(id, 'capitalize');
}

export function createSubstringGadget(id: string = 'substring'): StringExtractGadget {
  return new StringExtractGadget(id, 'substring');
}

export function createCharAtGadget(id: string = 'charAt'): StringExtractGadget {
  return new StringExtractGadget(id, 'charAt');
}

export function createIndexOfGadget(id: string = 'indexOf'): StringExtractGadget {
  return new StringExtractGadget(id, 'indexOf');
}

export function createStartsWithGadget(id: string = 'startsWith'): StringTestGadget {
  return new StringTestGadget(id, 'startsWith');
}

export function createEndsWithGadget(id: string = 'endsWith'): StringTestGadget {
  return new StringTestGadget(id, 'endsWith');
}

export function createIncludesGadget(id: string = 'includes'): StringTestGadget {
  return new StringTestGadget(id, 'includes');
}

export function createMatchesGadget(id: string = 'matches'): StringTestGadget {
  return new StringTestGadget(id, 'matches');
}

export function createSplitGadget(id: string = 'split'): StringSplitGadget {
  return new StringSplitGadget(id);
}

export function createJoinGadget(id: string = 'join'): StringJoinGadget {
  return new StringJoinGadget(id);
}

export function createTemplateGadget(id: string, template: string): StringTemplateGadget {
  return new StringTemplateGadget(id, template);
}