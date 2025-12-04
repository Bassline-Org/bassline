/**
 * Graph - Core data structures
 *
 * Quads: (entity, attribute, value, context) tuples
 * Graph: Container for quads
 */

export * from "./quad.js";
export * from "./graph.js";

// Shorthand aliases
export { quad as q } from "./quad.js";
export { word as w } from "../types.js";
