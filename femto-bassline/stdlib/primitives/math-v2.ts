/**
 * Math Primitive Gadgets v2
 * Pure, deterministic mathematical operations conforming to Gadget interface
 */

import { Gadget, allInputsActivation, toNumber } from './base';

/**
 * Create an addition gadget
 */
export function createAddGadget(id: string = 'add'): Gadget {
  return {
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: allInputsActivation(['a', 'b']),
    process: (inputs: Map<string, unknown>) => {
      const a = toNumber(inputs.get('a'));
      const b = toNumber(inputs.get('b'));
      const result = a + b;
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Adds two numbers',
    category: 'math'
  };
}

/**
 * Create a subtraction gadget
 */
export function createSubtractGadget(id: string = 'subtract'): Gadget {
  return {
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: allInputsActivation(['a', 'b']),
    process: (inputs: Map<string, unknown>) => {
      const a = toNumber(inputs.get('a'));
      const b = toNumber(inputs.get('b'));
      const result = a - b;
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Subtracts b from a',
    category: 'math'
  };
}

/**
 * Create a multiplication gadget
 */
export function createMultiplyGadget(id: string = 'multiply'): Gadget {
  return {
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: allInputsActivation(['a', 'b']),
    process: (inputs: Map<string, unknown>) => {
      const a = toNumber(inputs.get('a'));
      const b = toNumber(inputs.get('b'));
      const result = a * b;
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Multiplies two numbers',
    category: 'math'
  };
}

/**
 * Create a division gadget
 */
export function createDivideGadget(id: string = 'divide'): Gadget {
  return {
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: allInputsActivation(['a', 'b']),
    process: (inputs: Map<string, unknown>) => {
      const a = toNumber(inputs.get('a'));
      const b = toNumber(inputs.get('b'));
      const result = b !== 0 ? a / b : 0; // Avoid division by zero
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Divides a by b',
    category: 'math'
  };
}

/**
 * Create a modulo gadget
 */
export function createModuloGadget(id: string = 'modulo'): Gadget {
  return {
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: allInputsActivation(['a', 'b']),
    process: (inputs: Map<string, unknown>) => {
      const a = toNumber(inputs.get('a'));
      const b = toNumber(inputs.get('b'));
      const result = b !== 0 ? a % b : 0;
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Computes a modulo b',
    category: 'math'
  };
}

/**
 * Create a power gadget
 */
export function createPowerGadget(id: string = 'power'): Gadget {
  return {
    inputs: ['base', 'exponent'],
    outputs: ['result'],
    activation: allInputsActivation(['base', 'exponent']),
    process: (inputs: Map<string, unknown>) => {
      const base = toNumber(inputs.get('base'));
      const exponent = toNumber(inputs.get('exponent'));
      const result = Math.pow(base, exponent);
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Raises base to the power of exponent',
    category: 'math'
  };
}

/**
 * Create an absolute value gadget
 */
export function createAbsGadget(id: string = 'abs'): Gadget {
  return {
    inputs: ['value'],
    outputs: ['result'],
    activation: allInputsActivation(['value']),
    process: (inputs: Map<string, unknown>) => {
      const value = toNumber(inputs.get('value'));
      const result = Math.abs(value);
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Returns the absolute value',
    category: 'math'
  };
}

/**
 * Create a square root gadget
 */
export function createSqrtGadget(id: string = 'sqrt'): Gadget {
  return {
    inputs: ['value'],
    outputs: ['result'],
    activation: allInputsActivation(['value']),
    process: (inputs: Map<string, unknown>) => {
      const value = toNumber(inputs.get('value'));
      const result = Math.sqrt(Math.abs(value)); // Avoid NaN for negative numbers
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Returns the square root',
    category: 'math'
  };
}

/**
 * Create a min gadget
 */
export function createMinGadget(id: string = 'min'): Gadget {
  return {
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: allInputsActivation(['a', 'b']),
    process: (inputs: Map<string, unknown>) => {
      const a = toNumber(inputs.get('a'));
      const b = toNumber(inputs.get('b'));
      const result = Math.min(a, b);
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Returns the minimum of two numbers',
    category: 'math'
  };
}

/**
 * Create a max gadget
 */
export function createMaxGadget(id: string = 'max'): Gadget {
  return {
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: allInputsActivation(['a', 'b']),
    process: (inputs: Map<string, unknown>) => {
      const a = toNumber(inputs.get('a'));
      const b = toNumber(inputs.get('b'));
      const result = Math.max(a, b);
      return new Map([['result', result]]);
    },
    isPure: true,
    description: 'Returns the maximum of two numbers',
    category: 'math'
  };
}

/**
 * Create a comparison gadget
 */
export function createCompareGadget(
  id: string = 'compare',
  op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' = 'eq'
): Gadget {
  const operations = {
    eq: (a: number, b: number) => a === b,
    neq: (a: number, b: number) => a !== b,
    lt: (a: number, b: number) => a < b,
    lte: (a: number, b: number) => a <= b,
    gt: (a: number, b: number) => a > b,
    gte: (a: number, b: number) => a >= b
  };
  
  const descriptions = {
    eq: 'Returns true if a equals b',
    neq: 'Returns true if a does not equal b',
    lt: 'Returns true if a is less than b',
    lte: 'Returns true if a is less than or equal to b',
    gt: 'Returns true if a is greater than b',
    gte: 'Returns true if a is greater than or equal to b'
  };
  
  return {
    inputs: ['a', 'b'],
    outputs: ['result'],
    activation: allInputsActivation(['a', 'b']),
    process: (inputs: Map<string, unknown>) => {
      const a = toNumber(inputs.get('a'));
      const b = toNumber(inputs.get('b'));
      const result = operations[op](a, b);
      return new Map([['result', result]]);
    },
    isPure: true,
    description: descriptions[op],
    category: 'math'
  };
}

/**
 * Create a sum gadget that adds multiple inputs
 */
export function createSumGadget(id: string = 'sum', inputCount: number = 3): Gadget {
  const inputNames = Array.from({ length: inputCount }, (_, i) => `input${i + 1}`);
  
  return {
    inputs: inputNames,
    outputs: ['sum'],
    activation: allInputsActivation(inputNames),
    process: (inputs: Map<string, unknown>) => {
      let sum = 0;
      for (const inputName of inputNames) {
        sum += toNumber(inputs.get(inputName));
      }
      return new Map([['sum', sum]]);
    },
    isPure: true,
    description: `Sums ${inputCount} numbers`,
    category: 'math'
  };
}

/**
 * Create a product gadget that multiplies multiple inputs
 */
export function createProductGadget(id: string = 'product', inputCount: number = 3): Gadget {
  const inputNames = Array.from({ length: inputCount }, (_, i) => `input${i + 1}`);
  
  return {
    inputs: inputNames,
    outputs: ['product'],
    activation: allInputsActivation(inputNames),
    process: (inputs: Map<string, unknown>) => {
      let product = 1;
      for (const inputName of inputNames) {
        product *= toNumber(inputs.get(inputName));
      }
      return new Map([['product', product]]);
    },
    isPure: true,
    description: `Multiplies ${inputCount} numbers`,
    category: 'math'
  };
}