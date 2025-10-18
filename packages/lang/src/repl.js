import { parse } from "./parser.js";
import { createRuntime } from "./runtime.js";

/**
 * @typedef {Object} Runtime
 * @property {Object} context - The runtime context
 * @property {Function} evaluate - Safely evaluates Bassline code, catching parse and runtime errors
 *
 * @typedef {Object} Repl
 * @property {Runtime} runtime - The runtime instance
 * @property {Function} evaluate - Safely evaluates Bassline code, catching parse and runtime errors
 */

/**
 * Create a REPL instance with safe evaluation
 *
 * @returns {Repl} A repl instance
 */
export function createRepl() {
    const runtime = createRuntime();
    return {
        runtime,
        evaluate(source) {
            try {
                const ast = parse(source);
                const result = runtime.evaluate(ast);
                return { ok: true, value: result };
            } catch (error) {
                return {
                    ok: false,
                    error: error.message,
                };
            }
        },
    };
}
