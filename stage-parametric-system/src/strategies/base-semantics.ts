import { MetaEnv, Expression } from '../types';

/**
 * Base semantics strategy - implements normal execution behavior
 * These functions execute normally when not overridden by meta-environments
 */
export const baseSemanticsStrategy: MetaEnv = {
  // Arithmetic operations - execute normally
  add: (a: any, b: any) => a + b,
  multiply: (a: any, b: any) => a * b,
  subtract: (a: any, b: any) => a - b,
  divide: (a: any, b: any) => a / b,
  
  // Comparison operations - execute normally
  equals: (a: any, b: any) => a === b,
  lessThan: (a: any, b: any) => a < b,
  greaterThan: (a: any, b: any) => a > b,
  
  // Function application - execute normally
  apply: (fn: any, ...args: any[]) => {
    if (typeof fn !== 'function') {
      throw new Error(`Cannot apply non-function: ${fn}`);
    }
    return fn(...args);
  },
  
  // Reactive primitives - these would be implemented by the reactive system
  cell: (mergeFn: any, initialValue?: any) => {
    // This would be implemented by the actual reactive system
    console.log(`[BASE] Creating cell with mergeFn:`, mergeFn, 'initialValue:', initialValue);
    return {
      mergeFn,
      initialValue,
      downstream: new Set(),
      isWired: false,
      isGadget: false,
      currentValue: initialValue
    };
  },
  
  gadget: (body: Expression) => {
    // This would be implemented by the actual reactive system
    console.log(`[BASE] Creating gadget with expression body`);
    return {
      body,
      downstream: new Set(),
      isWired: false,
      isGadget: true
    };
  },
  
  // Wiring primitives - execute normally
  wire: (source: any, target: any) => {
    console.log(`[BASE] Wiring ${source} to ${target}`);
    if (source && typeof source === 'object' && 'downstream' in source) {
      source.downstream.add(target);
    }
  },
  
  into: (source: any, target: any) => {
    console.log(`[BASE] Explicit wiring: ${source} into ${target}`);
    if (source && typeof source === 'object' && 'downstream' in source) {
      source.downstream.add(target);
      if (typeof target === 'function' && 'value' in source) {
        target(source.value());
      }
    }
    return target;
  }
};
