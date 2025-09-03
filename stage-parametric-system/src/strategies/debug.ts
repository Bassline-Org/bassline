import { MetaEnv } from '../types';

/**
 * Debug strategy - adds logging to function calls
 */
export const debugStrategy: MetaEnv = {
  log: (message: string, ...args: any[]) => {
    console.log(`[DEBUG] ${message}`, ...args);
  },
  
  // Override any function to add debug logging
  // Example: if we want to debug cell creation
  cell: (mergeFn: any, initialValue?: any) => {
    console.log('[DEBUG] Creating cell with mergeFn:', mergeFn, 'initialValue:', initialValue);
    // Fall back to original implementation
    return undefined; // This will cause fallback to original
  },
  
  gadget: (body: (...args: any[]) => any) => {
    console.log('[DEBUG] Creating gadget with body:', body.toString());
    // Fall back to original implementation
    return undefined; // This will cause fallback to original
  }
};
