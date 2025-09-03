import { Expression, CallExpression, BinaryExpression, VariableExpression, LiteralExpression, BlockExpression } from './types';

/**
 * JavaScript port of base.scm - the fundamental staged interpreter infrastructure
 */

// Global state for expression generation (equivalent to stFresh, stBlock, stFun)
let stFresh = 0;
let stBlock: Expression[] = [];
let stFun: Array<{ id: number, env: any[], body: Expression }> = [];

// Utility functions
function tagged(tag: string) {
  return (expr: any) => expr && typeof expr === 'object' && expr.type === tag;
}

function isCode(expr: any): boolean {
  return tagged('code')(expr);
}

function forceCode(expr: any): Expression {
  if (isCode(expr)) {
    return expr.body;
  }
  throw new Error(`Expected code, not ${JSON.stringify(expr)}`);
}

function makeLet(e1: Expression, e2: Expression): Expression {
  return { type: 'block', expressions: [e1, e2] };
}

// Core staged interpreter functions
export function reset(): void {
  stFresh = 0;
  stBlock = [];
  stFun = [];
}

export function run<T>(thunk: () => T): T {
  const savedFresh = stFresh;
  const savedBlock = [...stBlock];
  const savedFun = [...stFun];
  
  try {
    return thunk();
  } finally {
    stFresh = savedFresh;
    stBlock = savedBlock;
    stFun = savedFun;
  }
}

export function fresh(): VariableExpression {
  stFresh++;
  return { type: 'variable', name: `var${stFresh - 1}` };
}

export function reflect(expr: Expression): VariableExpression {
  stBlock.push(expr);
  return fresh();
}

export function reify(thunk: () => Expression): Expression {
  return run(() => {
    stBlock = [];
    const last = thunk();
    return stBlock.reduceRight((acc, expr) => makeLet(expr, acc), last);
  });
}

export function reifyc(thunk: () => any): Expression {
  return reify(() => forceCode(thunk()));
}

export function reflectc(expr: Expression): Expression {
  return { type: 'code', body: reflect(expr) };
}

// Find function in stFun (equivalent to findFun in base.scm)
function findFun(closure: any): number | null {
  for (const f of stFun) {
    if (f.env === closure.env && f.body === closure.body) {
      return f.id;
    }
  }
  return null;
}

// Core lift function - the heart of the staged interpreter
export function lift(value: any): any {
  // Numbers and symbols pass through
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  
  // Handle closures (functions)
  if (typeof value === 'function') {
    const n = findFun(value);
    if (n !== null) {
      return { type: 'variable', name: `var${n}` };
    }
    
    // Add to stFun and reflect
    stFun.push({ id: stFresh, env: [], body: { type: 'literal', value: value.toString() } });
    return reflect({
      type: 'call',
      callee: { type: 'variable', name: 'lambda' },
      args: [reify(() => {
        // This would need the actual function body reification
        return { type: 'literal', value: 'function_body' };
      })]
    });
  }
  
  // Handle code values
  if (isCode(value)) {
    return reflect({
      type: 'call',
      callee: { type: 'variable', name: 'lift' },
      args: [forceCode(value)]
    });
  }
  
  // Handle pairs/objects
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    const a = forceCode(value[0] || value);
    const b = forceCode(value[1] || value);
    return reflect({
      type: 'call',
      callee: { type: 'variable', name: 'cons' },
      args: [a, b]
    });
  }
  
  return value;
}

// Lookup function for environment - using traditional named environments
export function lookup(env: Record<string, any>, name: string): any {
  if (name in env) {
    return env[name];
  }
  throw new Error(`Unbound variable: ${name}`);
}

// Binary operations with maybe-lift pattern - simplified
export function binaryOp(fun: (a: any, b: any) => any) {
  return (env: Record<string, any>, left: any, right: any) => {
    const v1 = evalms(env, left);
    const v2 = evalms(env, right);
    
    if (isCode(v1) && isCode(v2)) {
      return reflectc({
        type: 'binary',
        operator: fun.name || 'op',
        left: forceCode(v1),
        right: forceCode(v2)
      });
    }
    
    if (!isCode(v1) && !isCode(v2)) {
      return fun(v1, v2);
    }
    
    throw new Error(`Stage error in binary operation: ${JSON.stringify(v1)} ${JSON.stringify(v2)}`);
  };
}

// Unary operations with maybe-lift pattern - simplified
export function unaryOp(fun: (a: any) => any) {
  return (env: Record<string, any>, arg: any) => {
    const v1 = evalms(env, arg);
    
    if (isCode(v1)) {
      return reflectc({
        type: 'call',
        callee: { type: 'variable', name: fun.name || 'unary' },
        args: [forceCode(v1)]
      });
    }
    
    return fun(v1);
  };
}

// Predicate operations - simplified
export function predOp(fun: (a: any) => boolean) {
  return (env: Record<string, any>, arg: any) => {
    const v1 = evalms(env, arg);
    
    if (isCode(v1)) {
      return reflectc({
        type: 'call',
        callee: { type: 'variable', name: fun.name || 'pred' },
        args: [forceCode(v1)]
      });
    }
    
    return fun(v1) ? 1 : 0;
  };
}

// The main staged interpreter - stage-polymorphic with maybe-lift parameter
export function evalms(maybeLift: (value: any) => any, env: Record<string, any>, expr: any): any {
  // Numbers and strings - wrap with maybe-lift
  if (typeof expr === 'number' || typeof expr === 'string') {
    return maybeLift(expr);
  }
  
  // Literal expressions - extract the value and wrap with maybe-lift
  if (tagged('literal')(expr)) {
    return maybeLift(expr.value);
  }
  
  // Variables
  if (tagged('variable')(expr)) {
    return lookup(env, expr.name);
  }
  
  // Lambda expressions - wrap with maybe-lift
  if (tagged('lambda')(expr)) {
    return maybeLift({ type: 'closure', env, body: expr.body, parameters: expr.parameters });
  }
  
  // Let expressions - simplified
  if (tagged('let')(expr)) {
    const v1 = evalms(maybeLift, env, expr.value);
    const newEnv = { ...env, [expr.name]: v1 };
    return evalms(maybeLift, newEnv, expr.body);
  }
  
  // Lift expressions
  if (tagged('lift')(expr)) {
    return { type: 'code', body: lift(evalms(maybeLift, env, expr.args[0])) };
  }
  
  // Binary operations
  if (tagged('binary')(expr)) {
    const v1 = evalms(maybeLift, env, expr.left);
    const v2 = evalms(maybeLift, env, expr.right);
    
    if (isCode(v1) && isCode(v2)) {
      return reflectc({
        type: 'binary',
        operator: expr.operator,
        left: forceCode(v1),
        right: forceCode(v2)
      });
    }
    
    if (!isCode(v1) && !isCode(v2)) {
      let result: any;
      switch (expr.operator) {
        case '+': result = v1 + v2; break;
        case '-': result = v1 - v2; break;
        case '*': result = v1 * v2; break;
        case '/': result = v1 / v2; break;
        case '==': result = v1 === v2 ? 1 : 0; break;
        case '<': result = v1 < v2 ? 1 : 0; break;
        case '>': result = v1 > v2 ? 1 : 0; break;
        default: throw new Error(`Unknown binary operator: ${expr.operator}`);
      }
      return maybeLift(result);
    }
    
    throw new Error(`Stage error in binary operation: ${JSON.stringify(v1)} ${JSON.stringify(v2)}`);
  }
  
  // Call expressions - simplified
  if (tagged('call')(expr)) {
    const v1 = evalms(maybeLift, env, expr.callee);
    const args = expr.args.map((arg: any) => evalms(maybeLift, env, arg));
    
    if (isCode(v1) && args.every((arg: any) => isCode(arg))) {
      return { type: 'code', body: reflect({
        type: 'call',
        callee: forceCode(v1),
        args: args.map((arg: any) => forceCode(arg))
      })};
    }
    
    if (tagged('closure')(v1)) {
      // Create new environment with bound arguments
      const newEnv = { ...v1.env };
      v1.parameters.forEach((param: string, i: number) => {
        newEnv[param] = args[i];
      });
      return evalms(maybeLift, newEnv, v1.body);
    }
    
    // If it's a regular function, call it
    if (typeof v1 === 'function') {
      return v1(...args);
    }
    
    throw new Error(`Application expects closure or function, not ${JSON.stringify(v1)}`);
  }
  
  return expr;
}

// Logging function
export function log(expr: any): any {
  console.log(JSON.stringify(expr, null, 2));
  return expr;
}
