/**
 * Node.js Effects Extension
 *
 * Filesystem effects that require Node.js runtime.
 *
 * Usage:
 *   import { installNodeEffects } from '../extensions/effects-node/index.js';
 *   installNodeEffects(runtime.graph);
 *
 * This is opt-in to maintain browser compatibility.
 */

export { installNodeEffects } from './installer.js';
export { nodeEffects } from './definitions.js';
