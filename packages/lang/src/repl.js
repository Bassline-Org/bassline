import { parse } from "./parser.js";
import { ex, createPreludeContext } from "./prelude.js";

/**
 * Create a REPL instance with safe evaluation
 *
 * Returns an object with:
 * - eval(input): Safely evaluates Bassline code, catching parse and runtime errors
 * - context: The prelude context for direct manipulation
 */
export function createRepl() {
    const context = createPreludeContext();

    return {
        /**
         * Safely evaluate Bassline code
         * @param {string} input - Bassline code to evaluate
         * @returns {{ ok: true, value: any } | { ok: false, error: string }}
         */
        eval(input) {
            try {
                const ast = parse(input);
                const result = ex(context, ast);
                return { ok: true, value: result };
            } catch (error) {
                return {
                    ok: false,
                    error: error.message,
                    stack: error.stack,
                };
            }
        },

        // Expose context for direct access if needed
        context,
    };
}
