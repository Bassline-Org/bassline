/**
 * Combine builder - Merge multiple sources
 *
 * Creates multiple source gadgets that all feed into a single merger gadget.
 *
 * @param {Array} sources - Array of source definitions
 * @param {Object} source.spec - Gadget spec for this source
 * @param {string} [source.extract] - Effect key to extract before sending to merger
 * @param {string} [source.name] - Custom name for this source
 * @param {Object} mergerSpec - Spec for the merger gadget
 * @param {Object} [options] - Combine options
 * @param {string} [options.mergerName] - Name of merger gadget (default: "merger")
 * @returns {Array} Array of actions ready to send to sex gadget
 *
 * @example
 * const actions = combine(
 *   [
 *     { spec: { pkg: "@bassline/cells/numeric", name: "max", state: 0 }, extract: "changed" },
 *     { spec: { pkg: "@bassline/cells/numeric", name: "max", state: 0 }, extract: "changed" }
 *   ],
 *   { pkg: "@bassline/functions/math", name: "add", state: {} }
 * );
 *
 * workspace.receive(actions);
 */
export function combine(sources, mergerSpec, options = {}) {
    const actions = [];
    const mergerName = options.mergerName || "merger";

    // Spawn all source gadgets
    sources.forEach((source, i) => {
        const sourceName = source.name || `source${i}`;
        actions.push(["spawn", sourceName, source.spec]);
    });

    // Spawn merger gadget
    actions.push(["spawn", mergerName, mergerSpec]);

    // Wire all sources to merger
    sources.forEach((source, i) => {
        const sourceName = source.name || `source${i}`;
        const wireName = `wire${i}`;
        const wireOptions = {};

        if (source.extract) {
            wireOptions.keys = Array.isArray(source.extract) ? source.extract : [source.extract];
        }

        actions.push(["wire", wireName, sourceName, mergerName, wireOptions]);
    });

    return actions;
}
