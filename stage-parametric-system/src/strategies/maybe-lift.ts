import { MetaEnv, Expression, CallExpression, BinaryExpression, VariableExpression, LiteralExpression } from '../types';

/**
 * Maybe-lift strategy - dynamically decides whether to execute or lift to expressions
 * This is the core of the stage-parametric system, inspired by Pink's lift function
 */

// Global state for expression generation
let freshCounter = 0;
let expressionBlock: Expression[] = [];

function fresh(): VariableExpression {
  freshCounter++;
  return { type: 'variable', name: `var${freshCounter - 1}` };
}

function reflect(expr: Expression): VariableExpression {
  expressionBlock.push(expr);
  return fresh();
}

function resetState(): void {
  freshCounter = 0;
  expressionBlock = [];
}

/**
 * Core lift function - decides whether to execute or lift to expressions
 */
function lift(value: any): any {
  // If it's already an expression, return as-is
  if (typeof value === 'object' && value.type) {
    return value;
  }
  
  // If it's a primitive, return as-is
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  
  // If it's a function, we need to decide based on context
  if (typeof value === 'function') {
    // For now, just return the function - in a full implementation,
    // we'd need to reify it to an expression
    return value;
  }
  
  // For complex objects, lift them to expressions
  return reflect({ type: 'literal', value });
}

export const maybeLiftStrategy: MetaEnv = {
  // Arithmetic operations with maybe-lift
  add: (a: any, b: any) => {
    const liftedA = lift(a);
    const liftedB = lift(b);
    
    // If both are primitives, execute normally
    if (typeof liftedA === 'number' && typeof liftedB === 'number') {
      return liftedA + liftedB;
    }
    
    // Otherwise, build an expression
    return {
      type: 'binary',
      operator: '+',
      left: typeof liftedA === 'object' && liftedA.type ? liftedA : { type: 'literal', value: liftedA },
      right: typeof liftedB === 'object' && liftedB.type ? liftedB : { type: 'literal', value: liftedB }
    };
  },
  
  multiply: (a: any, b: any) => {
    const liftedA = lift(a);
    const liftedB = lift(b);
    
    if (typeof liftedA === 'number' && typeof liftedB === 'number') {
      return liftedA * liftedB;
    }
    
    return {
      type: 'binary',
      operator: '*',
      left: typeof liftedA === 'object' && liftedA.type ? liftedA : { type: 'literal', value: liftedA },
      right: typeof liftedB === 'object' && liftedB.type ? liftedB : { type: 'literal', value: liftedB }
    };
  },
  
  subtract: (a: any, b: any) => {
    const liftedA = lift(a);
    const liftedB = lift(b);
    
    if (typeof liftedA === 'number' && typeof liftedB === 'number') {
      return liftedA - liftedB;
    }
    
    return {
      type: 'binary',
      operator: '-',
      left: typeof liftedA === 'object' && liftedA.type ? liftedA : { type: 'literal', value: liftedA },
      right: typeof liftedB === 'object' && liftedB.type ? liftedB : { type: 'literal', value: liftedB }
    };
  },
  
  divide: (a: any, b: any) => {
    const liftedA = lift(a);
    const liftedB = lift(b);
    
    if (typeof liftedA === 'number' && typeof liftedB === 'number') {
      return liftedA / liftedB;
    }
    
    return {
      type: 'binary',
      operator: '/',
      left: typeof liftedA === 'object' && liftedA.type ? liftedA : { type: 'literal', value: liftedA },
      right: typeof liftedB === 'object' && liftedB.type ? liftedB : { type: 'literal', value: liftedB }
    };
  },
  
  // Comparison operations with maybe-lift
  equals: (a: any, b: any) => {
    const liftedA = lift(a);
    const liftedB = lift(b);
    
    if (typeof liftedA !== 'object' && typeof liftedB !== 'object') {
      return liftedA === liftedB;
    }
    
    return {
      type: 'binary',
      operator: '==',
      left: typeof liftedA === 'object' && liftedA.type ? liftedA : { type: 'literal', value: liftedA },
      right: typeof liftedB === 'object' && liftedB.type ? liftedB : { type: 'literal', value: liftedB }
    };
  },
  
  // Function application with maybe-lift
  apply: (fn: any, ...args: any[]) => {
    const liftedFn = lift(fn);
    const liftedArgs = args.map(lift);
    
    // If fn is a function and all args are primitives, execute
    if (typeof liftedFn === 'function' && liftedArgs.every(arg => typeof arg !== 'object' || !arg.type)) {
      return liftedFn(...liftedArgs);
    }
    
    // Otherwise, build a call expression
    return {
      type: 'call',
      callee: typeof liftedFn === 'object' && liftedFn.type ? liftedFn : { type: 'literal', value: liftedFn },
      args: liftedArgs.map(arg => 
        typeof arg === 'object' && arg.type ? arg : { type: 'literal', value: arg }
      )
    };
  },
  
  // Reactive primitives with maybe-lift
  cell: (mergeFn: any, initialValue?: any) => {
    const liftedMergeFn = lift(mergeFn);
    const liftedInitialValue = initialValue !== undefined ? lift(initialValue) : undefined;
    
    // Always build an expression for reactive primitives
    return {
      type: 'call',
      callee: { type: 'variable', name: 'cell' },
      args: [
        typeof liftedMergeFn === 'object' && liftedMergeFn.type ? liftedMergeFn : { type: 'literal', value: liftedMergeFn },
        ...(liftedInitialValue !== undefined ? [typeof liftedInitialValue === 'object' && liftedInitialValue.type ? liftedInitialValue : { type: 'literal', value: liftedInitialValue }] : [])
      ]
    };
  },
  
  gadget: (body: Expression) => {
    return {
      type: 'call',
      callee: { type: 'variable', name: 'gadget' },
      args: [body]
    };
  },
  
  // Wiring primitives with maybe-lift
  wire: (source: any, target: any) => {
    const liftedSource = lift(source);
    const liftedTarget = lift(target);
    
    return {
      type: 'call',
      callee: { type: 'variable', name: 'wire' },
      args: [
        typeof liftedSource === 'object' && liftedSource.type ? liftedSource : { type: 'literal', value: liftedSource },
        typeof liftedTarget === 'object' && liftedTarget.type ? liftedTarget : { type: 'literal', value: liftedTarget }
      ]
    };
  },
  
  into: (source: any, target: any) => {
    const liftedSource = lift(source);
    const liftedTarget = lift(target);
    
    return {
      type: 'call',
      callee: { type: 'variable', name: 'into' },
      args: [
        typeof liftedSource === 'object' && liftedSource.type ? liftedSource : { type: 'literal', value: liftedSource },
        typeof liftedTarget === 'object' && liftedTarget.type ? liftedTarget : { type: 'literal', value: liftedTarget }
      ]
    };
  },
  
  // Utility functions
  reset: () => {
    resetState();
  },
  
  getExpressionBlock: () => [...expressionBlock],
  
  fresh: () => fresh()
};
