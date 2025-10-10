/**
 * Pipeline builder - Sequential composition
 *
 * Creates a linear sequence of function gadgets with automatic wiring.
 *
 * @param {Array} stages - Array of stage definitions
 * @param {Object} stage.spec - Gadget spec for this stage
 * @param {string} [stage.extract] - Effect key to extract (e.g., "result", "changed")
 * @param {string} [stage.name] - Custom name for this stage (default: stage0, stage1, etc.)
 * @param {Object} [options] - Pipeline options
 * @param {string} [options.input] - Name of input gadget (default: "input")
 * @param {string} [options.output] - Name of output gadget (default: "output")
 * @returns {Array} Array of actions ready to send to sex gadget
 *
 * @example
 * const actions = pipeline([
 *   { spec: { pkg: "@bassline/functions/math", name: "add", state: { b: 10 } }, extract: "result" },
 *   { spec: { pkg: "@bassline/functions/math", name: "multiply", state: { b: 2 } }, extract: "result" }
 * ]);
 *
 * workspace.receive(actions);
 */
export function pipeline(stages, options = {}) {
    const actions = [];
    const wirePrefix = options.wirePrefix || "wire";

    stages.forEach((stage, i) => {
        const name = stage.name || `stage${i}`;

        // Spawn the stage gadget
        actions.push(["spawn", name, stage.spec]);

        // Wire to next stage (if not last)
        if (i < stages.length - 1) {
            const nextName = stages[i + 1].name || `stage${i + 1}`;
            const wireName = `${wirePrefix}${i}`;
            const wireOptions = {};

            // Add key extraction if specified
            if (stage.extract) {
                wireOptions.keys = Array.isArray(stage.extract) ? stage.extract : [stage.extract];
            }

            actions.push(["wire", wireName, name, nextName, wireOptions]);
        }
    });

    return actions;
}
