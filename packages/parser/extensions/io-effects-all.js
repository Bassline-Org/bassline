/**
 * All Built-in Effects (Browser + Node.js)
 *
 * Convenience module that installs both browser-safe and Node.js effects.
 * Only works in Node.js environments.
 *
 * For browser-only, use: import { installBuiltinEffects } from './io-effects.js'
 * For Node-only, use: import { installNodeEffects } from './io-effects-node.js'
 */

import { installBuiltinEffects } from './io-effects.js';
import { installNodeEffects } from './io-effects-node.js';

/**
 * Install ALL built-in effects (browser + Node.js)
 *
 * @param {Graph} graph - The graph instance
 * @returns {Map} Map of effect names to unwatch functions
 */
export function installAllEffects(graph) {
  const browserUnwatchMap = installBuiltinEffects(graph);
  const nodeUnwatchMap = installNodeEffects(graph);

  // Merge maps
  return new Map([...browserUnwatchMap, ...nodeUnwatchMap]);
}
