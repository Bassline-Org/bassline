/**
 * Fork builder - Parallel distribution
 *
 * Creates a gadget that distributes input to multiple branches in parallel.
 *
 * @param {Array} branches - Array of branch definitions
 * @param {Object} branch.spec - Gadget spec for this branch
 * @param {string} [branch.extract] - Effect key to extract before sending to branch
 * @param {string} [branch.name] - Custom name for this branch
 * @param {Object} [options] - Fork options
 * @param {Object} [options.inputSpec] - Spec for input gadget (default: cells.last)
 * @param {string} [options.inputName] - Name of input gadget (default: "input")
 * @returns {Array} Array of actions ready to send to sex gadget
 *
 * @example
 * const actions = fork([
 *   { spec: { pkg: "@bassline/functions/math", name: "add", state: { b: 5 } }, extract: "changed" },
 *   { spec: { pkg: "@bassline/functions/math", name: "multiply", state: { b: 2 } }, extract: "changed" }
 * ]);
 *
 * workspace.receive(actions);
 */
export function fork(branches, options = {}) {
    const actions = [];
    const inputName = options.inputName || "input";
    const inputSpec = options.inputSpec || {
        pkg: "@bassline/cells/unsafe",
        name: "last",
        state: null,
    };

    // Spawn input gadget
    actions.push(["spawn", inputName, inputSpec]);

    // Spawn each branch and wire from input
    branches.forEach((branch, i) => {
        const branchName = branch.name || `branch${i}`;

        // Spawn branch gadget
        actions.push(["spawn", branchName, branch.spec]);

        // Wire input to branch
        const wireName = `wire${i}`;
        const wireOptions = {};

        if (branch.extract) {
            wireOptions.keys = Array.isArray(branch.extract) ? branch.extract : [branch.extract];
        }

        actions.push(["wire", wireName, inputName, branchName, wireOptions]);
    });

    return actions;
}
