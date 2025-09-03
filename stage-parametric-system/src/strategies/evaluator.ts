import { MetaEnv, Expression, FunctionDefinition } from '../types';

/**
 * Evaluator strategy - evaluates expressions in the staged interpreter
 */
export const evaluatorStrategy: MetaEnv = {
  eval: (expr: Expression, env: Record<string, any>): any => {
    switch (expr.type) {
      case 'literal':
        return expr.value;
        
      case 'variable':
        if (env[expr.name] === undefined) {
          throw new Error(`Undefined variable: ${expr.name}`);
        }
        return env[expr.name];
        
      case 'call':
        const callee = evaluatorStrategy.eval!(expr.callee, env);
        const args = expr.args.map(arg => evaluatorStrategy.eval!(arg, env));
        
        if (typeof callee !== 'function') {
          throw new Error(`Cannot call non-function: ${callee}`);
        }
        
        return callee(...args);
        
      case 'binary':
        const left = evaluatorStrategy.eval!(expr.left, env);
        const right = evaluatorStrategy.eval!(expr.right, env);
        
        switch (expr.operator) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return left / right;
          case '==': return left === right;
          case '!=': return left !== right;
          case '<': return left < right;
          case '>': return left > right;
          case '<=': return left <= right;
          case '>=': return left >= right;
          default:
            throw new Error(`Unknown binary operator: ${expr.operator}`);
        }
        
      case 'conditional':
        const condition = evaluatorStrategy.eval!(expr.condition, env);
        return condition ? 
          evaluatorStrategy.eval!(expr.thenExpr, env) : 
          evaluatorStrategy.eval!(expr.elseExpr, env);
          
      case 'block':
        let result: any = undefined;
        for (const blockExpr of expr.expressions) {
          result = evaluatorStrategy.eval!(blockExpr, env);
        }
        return result;
        
      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  },
  
  evaluate: (fnDef: FunctionDefinition, ...args: any[]): any => {
    // Create environment with bound parameters
    const env: Record<string, any> = {};
    fnDef.parameters.forEach((param, i) => {
      env[param] = args[i];
    });
    
    return evaluatorStrategy.eval!(fnDef.body, env);
  },
  
  define: (name: string, body: Expression, metadata?: Record<string, any>): FunctionDefinition => {
    // Extract parameter names from metadata or infer from body
    const parameters = metadata?.parameters || [];
    
    return {
      name,
      body,
      parameters,
      source: `function ${name}(${parameters.join(', ')}) { /* AST */ }`,
      metadata
    };
  }
};
