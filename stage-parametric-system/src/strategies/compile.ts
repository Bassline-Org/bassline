import { MetaEnv, FunctionDefinition } from '../types';

/**
 * Compilation strategy - generates code from reified function definitions
 */
export const compileStrategy: MetaEnv = {
  define: (name: string, body: (...args: any[]) => any, metadata?: Record<string, any>): FunctionDefinition => {
    // Extract parameter names from function
    const paramNames = body.toString()
      .match(/\(([^)]*)\)/)?.[1]
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0) || [];
    
    return {
      name,
      body,
      parameters: paramNames,
      source: body.toString(),
      metadata
    };
  },
  
  reify: (fn: (...args: any[]) => any): FunctionDefinition => {
    const name = fn.name || 'anonymous';
    return compileStrategy.define!(name, fn);
  },
  
  compile: (fnDef: FunctionDefinition): string => {
    console.log(`[COMPILE] Compiling function: ${fnDef.name}`);
    console.log(`[COMPILE] Parameters: [${fnDef.parameters.join(', ')}]`);
    console.log(`[COMPILE] Source: ${fnDef.source}`);
    
    // Generate compiled code (placeholder implementation)
    const compiledCode = `function ${fnDef.name}(${fnDef.parameters.join(', ')}) {
  // Compiled version of: ${fnDef.source}
  return ${fnDef.name}_compiled(${fnDef.parameters.join(', ')});
}`;
    
    return compiledCode;
  },
  
  compilePartial: (fnDef: FunctionDefinition, boundArgs: any[]): string => {
    console.log(`[COMPILE] Partial compilation of: ${fnDef.name}`);
    console.log(`[COMPILE] Bound args: [${boundArgs.join(', ')}]`);
    
    // Generate partially compiled code
    const remainingParams = fnDef.parameters.slice(boundArgs.length);
    const boundValues = boundArgs.map((arg, i) => `${fnDef.parameters[i]} = ${JSON.stringify(arg)}`).join(', ');
    
    const partialCode = `function ${fnDef.name}_partial(${remainingParams.join(', ')}) {
  // Partially compiled with: ${boundValues}
  // Remaining parameters: [${remainingParams.join(', ')}]
  return ${fnDef.name}_compiled(${boundArgs.join(', ')}, ${remainingParams.join(', ')});
}`;
    
    return partialCode;
  },
  
  partialEval: (fnDef: FunctionDefinition, boundArgs: any[]): FunctionDefinition => {
    console.log(`[COMPILE] Partial evaluation of: ${fnDef.name}`);
    
    // Create a new function definition with bound arguments
    const remainingParams = fnDef.parameters.slice(boundArgs.length);
    const boundBody = (...args: any[]) => {
      const allArgs = [...boundArgs, ...args];
      return fnDef.body(...allArgs);
    };
    
    return {
      name: `${fnDef.name}_partial`,
      body: boundBody,
      parameters: remainingParams,
      source: `// Partially evaluated: ${fnDef.source}`,
      metadata: {
        ...fnDef.metadata,
        boundArgs,
        originalFunction: fnDef.name
      }
    };
  }
};
