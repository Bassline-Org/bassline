/**
 * Effects Extension (Core)
 *
 * Browser-compatible side-effecting operations for pattern-based I/O.
 *
 * This module provides:
 * - I/O effects (console logging)
 * - HTTP effects (GET, POST requests)
 *
 * For Node.js-specific effects (filesystem), see extensions/effects-node.
 *
 * Effects follow the same pattern as compute operations:
 * - Pattern-triggered execution
 * - Self-describing via TYPE! convention
 * - Results written to graph when complete
 */

export { installEffects } from './installer.js';
export { builtinEffects } from './definitions.js';
