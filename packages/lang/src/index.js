/**
 * @bassline/lang - Main entry point
 *
 * Exports the core Bassline language types and functions
 */

export { parse } from "./parser.js";
export * from "./prelude/index.js";
export * from "./runtime.js";
export { evaluate } from "./evaluator.js";
