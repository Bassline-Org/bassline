import { MetaEnv, Expression, CallExpression, BinaryExpression, VariableExpression, LiteralExpression } from '../types';

/**
 * Expression builder strategy - builds expressions instead of executing
 * This is used when we want to generate code/expressions rather than execute
 */
export const expressionBuilderStrategy: MetaEnv = {
  // Arithmetic operations - build expressions
  add: (a: any, b: any): BinaryExpression => ({
    type: 'binary',
    operator: '+',
    left: typeof a === 'object' && a.type ? a : { type: 'literal', value: a },
    right: typeof b === 'object' && b.type ? b : { type: 'literal', value: b }
  }),
  
  multiply: (a: any, b: any): BinaryExpression => ({
    type: 'binary',
    operator: '*',
    left: typeof a === 'object' && a.type ? a : { type: 'literal', value: a },
    right: typeof b === 'object' && b.type ? b : { type: 'literal', value: b }
  }),
  
  subtract: (a: any, b: any): BinaryExpression => ({
    type: 'binary',
    operator: '-',
    left: typeof a === 'object' && a.type ? a : { type: 'literal', value: a },
    right: typeof b === 'object' && b.type ? b : { type: 'literal', value: b }
  }),
  
  divide: (a: any, b: any): BinaryExpression => ({
    type: 'binary',
    operator: '/',
    left: typeof a === 'object' && a.type ? a : { type: 'literal', value: a },
    right: typeof b === 'object' && b.type ? b : { type: 'literal', value: b }
  }),
  
  // Comparison operations - build expressions
  equals: (a: any, b: any): BinaryExpression => ({
    type: 'binary',
    operator: '==',
    left: typeof a === 'object' && a.type ? a : { type: 'literal', value: a },
    right: typeof b === 'object' && b.type ? b : { type: 'literal', value: b }
  }),
  
  lessThan: (a: any, b: any): BinaryExpression => ({
    type: 'binary',
    operator: '<',
    left: typeof a === 'object' && a.type ? a : { type: 'literal', value: a },
    right: typeof b === 'object' && b.type ? b : { type: 'literal', value: b }
  }),
  
  greaterThan: (a: any, b: any): BinaryExpression => ({
    type: 'binary',
    operator: '>',
    left: typeof a === 'object' && a.type ? a : { type: 'literal', value: a },
    right: typeof b === 'object' && b.type ? b : { type: 'literal', value: b }
  }),
  
  // Function application - build call expressions
  apply: (fn: any, ...args: any[]): CallExpression => ({
    type: 'call',
    callee: typeof fn === 'string' ? { type: 'variable', name: fn } : 
            typeof fn === 'object' && fn.type ? fn : { type: 'literal', value: fn },
    args: args.map(arg => 
      typeof arg === 'object' && arg.type ? arg : { type: 'literal', value: arg }
    )
  }),
  
  // Reactive primitives - build expressions for them too
  cell: (mergeFn: any, initialValue?: any): CallExpression => ({
    type: 'call',
    callee: { type: 'variable', name: 'cell' },
    args: [
      typeof mergeFn === 'object' && mergeFn.type ? mergeFn : { type: 'literal', value: mergeFn },
      ...(initialValue !== undefined ? [{ type: 'literal', value: initialValue }] : [])
    ]
  }),
  
  gadget: (body: Expression): CallExpression => ({
    type: 'call',
    callee: { type: 'variable', name: 'gadget' },
    args: [body]
  }),
  
  // Wiring primitives - build expressions
  wire: (source: any, target: any): CallExpression => ({
    type: 'call',
    callee: { type: 'variable', name: 'wire' },
    args: [
      typeof source === 'object' && source.type ? source : { type: 'literal', value: source },
      typeof target === 'object' && target.type ? target : { type: 'literal', value: target }
    ]
  }),
  
  into: (source: any, target: any): CallExpression => ({
    type: 'call',
    callee: { type: 'variable', name: 'into' },
    args: [
      typeof source === 'object' && source.type ? source : { type: 'literal', value: source },
      typeof target === 'object' && target.type ? target : { type: 'literal', value: target }
    ]
  })
};
