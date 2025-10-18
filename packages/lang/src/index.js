/**
 * @bassline/lang - Main entry point
 *
 * Exports the core Bassline language types and functions
 */

export { createRepl } from "./repl.js";
export { parse } from "./parser.js";
export { Context } from "./datatypes/index.js";
export { GLOBAL } from "./runtime.js";
export { evaluate } from "./evaluator.js";
