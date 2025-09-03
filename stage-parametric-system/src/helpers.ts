import { lift } from './base';
import { withEnv, executeInMeta, getMetaEnvStack } from './meta-env';
import { Expression, CallExpression, BinaryExpression, VariableExpression, LiteralExpression } from './types';

/**
 * Stage-polymorphic helper functions for building expressions
 * These functions work with meta-environments and can either execute or build expressions
 */

// Helper function to create literal expressions
function createLiteral(value: any): LiteralExpression {
  return { type: 'literal', value };
}

// Helper function to create variable expressions
function createVariable(name: string): VariableExpression {
  return { type: 'variable', name };
}

// Helper function to create call expressions
function createCall(callee: string | Expression, ...args: (any | Expression)[]): CallExpression {
  return {
    type: 'call',
    callee: typeof callee === 'string' ? createVariable(callee) : callee,
    args: args.map(arg => typeof arg === 'object' && arg.type ? arg : createLiteral(arg))
  };
}

// Helper function to create binary expressions
function createBinary(operator: string, left: any | Expression, right: any | Expression): BinaryExpression {
  return {
    type: 'binary',
    operator,
    left: typeof left === 'object' && left.type ? left : createLiteral(left),
    right: typeof right === 'object' && right.type ? right : createLiteral(right)
  };
}

/**
 * Stage-polymorphic namespace for expression building
 * These functions look up their current bindings in the environment,
 * and if null, use base semantics
 */
export const StagePolymorphic = {
  // Literal values - stage polymorphic
  lit: (value: any) => executeInMeta('lit', (val: any) => val, value),
  
  // Variables - stage polymorphic  
  var: (name: string) => executeInMeta('var', (n: string) => n, name),
  
  // Function calls - stage polymorphic
  call: (callee: string | Expression, ...args: (any | Expression)[]) => 
    executeInMeta('call', (fn: any, ...a: any[]) => fn(...a), callee, ...args),
  
  // Binary operations - stage polymorphic
  add: (left: any | Expression, right: any | Expression) => 
    executeInMeta('add', (a: any, b: any) => a + b, left, right),
  
  multiply: (left: any | Expression, right: any | Expression) => 
    executeInMeta('multiply', (a: any, b: any) => a * b, left, right),
  
  subtract: (left: any | Expression, right: any | Expression) => 
    executeInMeta('subtract', (a: any, b: any) => a - b, left, right),
  
  divide: (left: any | Expression, right: any | Expression) => 
    executeInMeta('divide', (a: any, b: any) => a / b, left, right),
  
  equals: (left: any | Expression, right: any | Expression) => 
    executeInMeta('equals', (a: any, b: any) => a === b, left, right),
  
  lessThan: (left: any | Expression, right: any | Expression) => 
    executeInMeta('lessThan', (a: any, b: any) => a < b, left, right),
  
  greaterThan: (left: any | Expression, right: any | Expression) => 
    executeInMeta('greaterThan', (a: any, b: any) => a > b, left, right),
  
  // Function definition - stage polymorphic
  def: (name: string, body: Expression) => 
    executeInMeta('def', (n: string, b: Expression) => ({ type: 'def', name: n, body: b }), name, body),
  
  // Let binding - stage polymorphic
  let: (name: string, value: any | Expression, body: Expression) => 
    executeInMeta('let', (n: string, v: any, b: Expression) => ({
      type: 'let',
      name: n,
      value: typeof v === 'object' && v.type ? v : createLiteral(v),
      body: b
    }), name, value, body)
};

// Export the helper functions for direct use
export { createLiteral, createVariable, createCall, createBinary };
