/**
 * Node.js Effect Installer
 *
 * Installs Node.js-specific effects (filesystem operations).
 * Uses the same pattern as core effects installer.
 */

import { installEffects } from '../effects/installer.js';
import { nodeEffects } from './definitions.js';

/**
 * Install Node.js-specific effect watchers on a graph
 * @param {Object} graph - Graph instance
 * @param {Object} effects - Effect definitions (defaults to nodeEffects)
 */
export function installNodeEffects(graph, effects = nodeEffects) {
  // Reuse core installer with Node-specific effects
  installEffects(graph, effects);
}
