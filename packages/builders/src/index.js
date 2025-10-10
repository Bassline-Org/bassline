/**
 * @bassline/builders - Declarative action builders for sex gadgets
 *
 * These functions return arrays of actions that can be sent directly to
 * sex gadgets. They make it easy to declaratively compose complex behaviors
 * without manually constructing spawn/wire action arrays.
 *
 * All builders return action arrays in the format:
 * [
 *   ["spawn", name, spec],
 *   ["wire", wireName, source, target, options],
 *   ...
 * ]
 *
 * Usage:
 * import { pipeline, fork, combine } from "@bassline/builders";
 * import { bl } from "@bassline/core";
 *
 * const actions = pipeline([...]);
 * workspace.receive(actions);
 *
 * // Or create a new sex gadget with actions as initial state
 * const gadget = bl().fromSpec({
 *   pkg: "@bassline/systems",
 *   name: "sex",
 *   state: actions
 * });
 */

export { pipeline } from "./pipeline.js";
export { fork } from "./fork.js";
export { combine } from "./combine.js";
export { map } from "./map.js";
