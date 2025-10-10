/**
 * Map builder - Transform with function
 *
 * Creates a simple input → function → output pipeline with key extraction.
 * This is a convenience wrapper around pipeline for the common case of
 * applying a single transformation.
 *
 * @param {Object} fnSpec - Function gadget spec
 * @param {string} [extractKey="changed"] - Key to extract from input
 * @param {string} [emitKey="result"] - Key to extract from function output
 * @param {Object} [options] - Map options
 * @param {string} [options.fnName] - Name for function gadget (default: "fn")
 * @returns {Array} Array of actions ready to send to sex gadget
 *
 * @example
 * const actions = map(
 *   { pkg: "@bassline/functions/math", name: "multiply", state: { b: 1.08 } },
 *   "changed",
 *   "result"
 * );
 *
 * workspace.receive(actions);
 */
export function map(fnSpec, extractKey = "changed", emitKey = "result", options = {}) {
    const actions = [];
    const fnName = options.fnName || "fn";

    // Just spawn the function - wiring will be handled externally
    actions.push(["spawn", fnName, fnSpec]);

    return actions;
}
