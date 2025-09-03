/**
 * Core types and interfaces for the stage-parametric system
 */

export interface MetaEnv {
  [functionName: string]: (...args: any[]) => any;
}

/**
 * Expression types for the staged interpreter
 */
export type Expression = 
  | LiteralExpression
  | VariableExpression
  | CallExpression
  | BinaryExpression
  | ConditionalExpression
  | BlockExpression
  | CodeExpression
  | LambdaExpression
  | LetExpression
  | LiftExpression;

export interface LiteralExpression {
  type: 'literal';
  value: any;
}

export interface VariableExpression {
  type: 'variable';
  name: string;
}

export interface CallExpression {
  type: 'call';
  callee: Expression;
  args: Expression[];
}

export interface BinaryExpression {
  type: 'binary';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface ConditionalExpression {
  type: 'conditional';
  condition: Expression;
  thenExpr: Expression;
  elseExpr: Expression;
}

export interface BlockExpression {
  type: 'block';
  expressions: Expression[];
}

export interface CodeExpression {
  type: 'code';
  body: Expression;
}

export interface LambdaExpression {
  type: 'lambda';
  parameters: string[];
  body: Expression;
}

export interface LetExpression {
  type: 'let';
  name: string;
  value: Expression;
  body: Expression;
}

export interface LiftExpression {
  type: 'lift';
  body: Expression;
}

/**
 * Reified function definition for stage-parametric manipulation
 */
export interface FunctionDefinition {
  name: string;
  body: Expression; // AST representation of the function body
  parameters: string[];
  source: string; // Original source code if available
  metadata?: Record<string, any>;
}

/**
 * Base semantic functions - these execute normally or build expressions based on stage
 */
export interface BaseSemantics {
  // Core reactive primitives
  cell: (mergeFn: any, initialValue?: any) => any;
  gadget: (body: Expression) => any;
  
  // Wiring primitives
  wire: (source: any, target: any) => void;
  into: (source: any, target: any) => any;
  
  // Function application
  apply: (fn: any, ...args: any[]) => any;
  
  // Arithmetic operations
  add: (a: any, b: any) => any;
  multiply: (a: any, b: any) => any;
  subtract: (a: any, b: any) => any;
  divide: (a: any, b: any) => any;
  
  // Comparison operations
  equals: (a: any, b: any) => any;
  lessThan: (a: any, b: any) => any;
  greaterThan: (a: any, b: any) => any;
}

/**
 * Meta-level functions for stage manipulation
 */
export interface MetaFunctions {
  // Function definition and manipulation
  define: (name: string, body: Expression, metadata?: Record<string, any>) => FunctionDefinition;
  reify: (fn: (...args: any[]) => any) => FunctionDefinition;
  
  // Expression evaluation
  eval: (expr: Expression, env: Record<string, any>) => any;
  
  // Evaluation functions
  evaluate: (fnDef: FunctionDefinition, ...args: any[]) => any;
  partialEval: (fnDef: FunctionDefinition, boundArgs: any[]) => FunctionDefinition;
  
  // Debug functions
  log: (message: string, ...args: any[]) => void;
  
  // Compilation functions
  compile: (fnDef: FunctionDefinition) => string;
  compilePartial: (fnDef: FunctionDefinition, boundArgs: any[]) => string;
}

/**
 * Combined interface for all stage-parametric functions
 */
export interface CoreFunctions extends BaseSemantics, MetaFunctions {}

/**
 * Strategy specification - defines which functions are overridden
 */
export interface StrategySpec {
  name: string;
  description: string;
  overrides: Partial<CoreFunctions>;
}
