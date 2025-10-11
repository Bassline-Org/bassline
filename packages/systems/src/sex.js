/// Sex: Sequential EXecution
/// Execute sequential actions in an environment
/// Useful for building compound gadgets
import { bl, fromSpec } from "@bassline/core"; // ← Need to import fromSpec

const { gadgetProto } = bl();

export const sex = Object.create(gadgetProto);
Object.assign(sex, {
    name: "sex",
    pkg: "@bassline/systems",

    // Override toSpec to include inputs/outputs
    toSpec() {
        const spec = {
            pkg: this.pkg,
            name: this.name,
            state: this.stateSpec(),
        };

        // Include inputs/outputs if defined
        if (this.inputs) {
            spec.inputs = this.inputs;
        }
        if (this.outputs) {
            spec.outputs = this.outputs;
        }

        return spec;
    },

    validate(input) {
        if (Array.isArray(input)) {
            return input;
        }
        return undefined;
    },
    afterSpawn(initial) {
        this.update({});
        this.receive(initial);

        // Set up output port taps after initial commands execute
        this.setupOutputTaps();
    },

    setupOutputTaps() {
        // Clean up existing taps if any
        if (this._outputTaps) {
            this._outputTaps.forEach(cleanup => cleanup());
        }
        this._outputTaps = [];

        // Set up new taps based on outputs spec
        if (this.outputs) {
            const state = this.current();

            for (const [portName, spec] of Object.entries(this.outputs)) {
                if (spec.routes_from && spec.effects) {
                    const sourceGadget = state[spec.routes_from];

                    if (sourceGadget) {
                        const cleanup = sourceGadget.tap((effect) => {
                            // Check if any of the specified effects are in this emission
                            for (const effectKey of spec.effects) {
                                if (effect[effectKey] !== undefined) {
                                    // Re-emit on external port name
                                    this.emit({ [portName]: effect[effectKey] });
                                }
                            }
                        });

                        this._outputTaps.push(cleanup);
                    } else {
                        console.warn(`[sex] Output port "${portName}" routes from unknown gadget: ${spec.routes_from}`);
                    }
                }
            }
        }
    },

    step(state, input) {
        // Check if object input with named fields (port routing)
        if (typeof input === 'object' && !Array.isArray(input) && input !== null) {
            // Route each field to internal gadgets based on inputs spec
            for (const [portName, value] of Object.entries(input)) {
                const inputSpec = this.inputs?.[portName];

                if (inputSpec?.routes_to) {
                    const targetGadget = state[inputSpec.routes_to];
                    if (targetGadget) {
                        targetGadget.receive(value);
                    } else {
                        console.warn(`[sex] Input port "${portName}" routes to unknown gadget: ${inputSpec.routes_to}`);
                    }
                }
            }
            return; // Input handled via routing
        }

        // Otherwise treat as command array
        this.execute(state, input).catch((err) => {
            console.error("Sexecution failed:", err);
            this.emit({ error: { err, input, state, timestamp: Date.now() } });
        });
    },

    async execute(state, actions) {
        const env = {
            spawned: { ...state },
            vals: {},
            activeRefs: [],
            activeVals: [],
        };
        for (const [action, ...rest] of actions) {
            await this.handleAction(env, action, ...rest);
        }

        this.update(env.spawned);
        this.emit({ completed: { ...env, timestamp: Date.now() } });
    },

    async handleAction(env, action, ...rest) {
        switch (action) {
            case "spawn": {
                const [localName, spec] = rest;
                if (env.spawned[localName]) {
                    console.warn(`${localName} already spawned, ignoring`);
                    break;
                }
                const substitutedSpec = this.substituteInObject(env, spec);
                const g = await fromSpec(substitutedSpec);
                env.spawned[localName] = g;
                break;
            }

            case "val": {
                const [localName, value] = rest;
                env.vals[localName] = value;
                break;
            }

            case "withVals": {
                const [valNames, doAction] = rest;
                env.activeVals.push(...valNames);
                await this.handleAction(env, ...doAction); // Just pass doAction directly
                env.activeVals = env.activeVals.filter((v) =>
                    !valNames.includes(v)
                );
                break;
            }

            case "ref": {
                const [names, doAction] = rest;
                env.activeRefs.push(...names);
                await this.handleAction(env, ...doAction); // Just pass doAction directly
                env.activeRefs = env.activeRefs.filter((n) =>
                    !names.includes(n)
                );
                break;
            }

            case "send": {
                const [target, value] = rest;
                if (gadgetProto.isPrototypeOf(target)) {
                    const substitutedValue = this.substituteInObject(
                        env,
                        value,
                    );
                    target.receive(substitutedValue);
                    break;
                }
                const gadget = env.spawned[target];
                if (!gadget) throw new Error(`Unknown target: ${target}`);
                const substitutedValue = this.substituteInObject(env, value);
                gadget.receive(substitutedValue);
                break;
            }

            default: {
                // Prototype fallback - check if method exists
                if (typeof this[action] === "function") {
                    const result = await this[action](env, ...rest);
                    if (result !== undefined) {
                        this.emit({ [action]: result });
                    }
                } else {
                    console.warn(`Unknown action: ${action}`);
                    this.emit({
                        error: {
                            message: `Unknown command: ${action}`,
                            action,
                            args: rest,
                            timestamp: Date.now(),
                        },
                    });
                }
                break;
            }
        }
    },
    substituteInObject(env, obj) {
        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map((item) => this.substituteInObject(env, item));
        }

        // Handle non-objects (primitives, null, etc.)
        if (typeof obj !== "object" || obj === null) {
            // Check if it's an active ref (string)
            if (typeof obj === "string" && env.activeRefs.includes(obj)) {
                return env.spawned[obj];
            }
            // Otherwise return as-is
            return obj;
        }

        // Handle $val pattern
        if (obj.$val && env.activeVals.includes(obj.$val)) {
            return env.vals[obj.$val];
        }

        // Handle regular objects
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = this.substituteInObject(env, value);
        }
        return result;
    },

    stateSpec() {
        // Convert current spawned gadgets back to spawn/wire actions
        const spawned = this.current();
        const actions = [];

        for (const [name, gadget] of Object.entries(spawned)) {
            // Wire gadgets become wire commands (not spawn)
            if (
                gadget.pkg === "@bassline/relations" &&
                gadget.name === "scopedWire"
            ) {
                const state = gadget.current();
                const wireAction = [
                    "wire",
                    name,
                    state.sourceName,
                    state.targetName,
                ];

                // Include options if present (keys, sourcePort, targetPort, etc.)
                const options = {};
                if (state.keys !== undefined) {
                    options.keys = state.keys;
                }
                if (state.sourcePort !== undefined) {
                    options.sourcePort = state.sourcePort;
                }
                if (state.targetPort !== undefined) {
                    options.targetPort = state.targetPort;
                }
                // Add other options as needed
                if (Object.keys(options).length > 0) {
                    wireAction.push(options);
                }

                actions.push(wireAction);
            } else {
                actions.push(["spawn", name, gadget.toSpec()]);
            }
        }

        return actions;
    },

    // ===== Workspace Management Commands =====

    /**
     * Clear gadget(s) from workspace
     * @param {Object} env - Execution environment
     * @param {string} [name] - Gadget name to clear, or undefined for all
     */
    clear(env, name) {
        if (name && env.spawned[name]) {
            env.spawned[name].kill?.();
            delete env.spawned[name];
            this.emit({ cleared: name });
            return name;
        } else if (!name) {
            // Clear all
            Object.values(env.spawned).forEach((g) => {
                g.kill?.();
            });
            env.spawned = {};
            this.emit({ cleared: "all" });
            return "all";
        } else {
            this.emit({
                error: {
                    message: `Gadget not found: ${name}`,
                    command: "clear",
                    name,
                },
            });
        }
    },

    /**
     * Rename a gadget
     * @param {Object} env - Execution environment
     * @param {string} oldName - Current name
     * @param {string} newName - New name
     */
    rename(env, oldName, newName) {
        if (!env.spawned[oldName]) {
            this.emit({
                error: {
                    message: `Gadget not found: ${oldName}`,
                    command: "rename",
                    oldName,
                },
            });
            return;
        }
        if (env.spawned[newName]) {
            this.emit({
                error: {
                    message: `Gadget already exists: ${newName}`,
                    command: "rename",
                    newName,
                },
            });
            return;
        }
        env.spawned[newName] = env.spawned[oldName];
        delete env.spawned[oldName];
        this.emit({ renamed: { from: oldName, to: newName } });
        return { from: oldName, to: newName };
    },

    /**
     * Capture current workspace state as snapshot
     * @param {Object} env - Execution environment
     * @param {string} [label="default"] - Snapshot label
     */
    snapshot(env, label = "default") {
        if (!this.snapshots) this.snapshots = {};
        // We need to capture from actual state, not env
        // So we update env first, then capture
        this.update(env.spawned);
        this.snapshots[label] = this.stateSpec();
        this.emit({ snapshot: label });
        return label;
    },

    /**
     * Restore workspace from snapshot
     * @param {Object} env - Execution environment
     * @param {string} [label="default"] - Snapshot label
     */
    async restore(env, label = "default") {
        if (!this.snapshots?.[label]) {
            this.emit({
                error: {
                    message: `No snapshot found: ${label}`,
                    command: "restore",
                    label,
                },
            });
            return;
        }
        // Clear current
        Object.values(env.spawned).forEach((g) => {
            g.kill?.();
        });
        env.spawned = {};

        // Restore from snapshot - execute the actions
        const snapshotActions = this.snapshots[label];
        for (const action of snapshotActions) {
            await this.handleAction(env, ...action);
        }

        this.emit({ restored: label });
        return label;
    },

    /**
     * List gadgets in workspace
     * @param {Object} env - Execution environment
     * @param {string} [filter] - Optional filter (pkg name)
     */
    list(env, filter) {
        const gadgets = Object.entries(env.spawned).map(([name, gadget]) => {
            const state = gadget.current();
            let preview = "";
            if (state === null || state === undefined) {
                preview = "null";
            } else if (typeof state === "object") {
                preview = Object.keys(state).length === 0
                    ? "{}"
                    : `{${Object.keys(state).length}}`;
            } else {
                const str = String(state);
                preview = str.length > 20 ? str.slice(0, 20) + "..." : str;
            }

            return {
                name,
                pkg: gadget.pkg,
                type: gadget.name,
                preview,
            };
        });

        const filtered = filter
            ? gadgets.filter((g) => g.pkg === filter)
            : gadgets;

        this.emit({ list: filtered });
        return filtered;
    },

    /**
     * Create a wire connection between two gadgets
     * @param {Object} env - Execution environment
     * @param {string} wireName - Name for the wire gadget
     * @param {string} sourceName - Source gadget name
     * @param {string} targetName - Target gadget name
     * @param {Object} [options] - Wire options (keys, transform, etc.)
     */
    async wire(env, wireName, sourceName, targetName, options = {}) {
        console.log("[sex.wire] Creating wire:", {
            wireName,
            sourceName,
            targetName,
            options,
            spawned: Object.keys(env.spawned),
        });

        // Check if wire name already exists
        if (env.spawned[wireName]) {
            this.emit({
                error: {
                    message: `Wire already exists: ${wireName}`,
                    command: "wire",
                    wireName,
                },
            });
            return;
        }

        // Check if source and target exist
        const source = env.spawned[sourceName];
        const target = env.spawned[targetName];

        if (!source) {
            this.emit({
                error: {
                    message: `Source gadget not found: ${sourceName}`,
                    command: "wire",
                    sourceName,
                },
            });
            return;
        }

        if (!target) {
            this.emit({
                error: {
                    message: `Target gadget not found: ${targetName}`,
                    command: "wire",
                    targetName,
                },
            });
            return;
        }

        // Spawn the wire gadget with both refs (runtime) and names (serialization)
        const wireGadget = await fromSpec({
            pkg: "@bassline/relations",
            name: "scopedWire",
            state: {
                source, // Gadget ref for runtime tapping
                target, // Gadget ref for runtime tapping
                sourceName, // Name for serialization/canvas
                targetName, // Name for serialization/canvas
                ...options, // Pass through keys and other options
            },
        });

        env.spawned[wireName] = wireGadget;
        console.log("[sex.wire] Wire created successfully:", {
            wireName,
            wireState: wireGadget.current(),
        });
        this.emit({ wired: { wireName, sourceName, targetName, options } });
        return { wireName, sourceName, targetName, options };
    },

    /**
     * List available commands
     * @param {Object} _env - Execution environment (unused)
     */
    help(_env) {
        const builtInCommands = [
            "spawn",
            "send",
            "val",
            "withVals",
            "ref",
        ];

        const protoCommands = Object.getOwnPropertyNames(this)
            .filter((key) =>
                typeof this[key] === "function" &&
                !key.startsWith("_") &&
                ![
                    "receive",
                    "validate",
                    "current",
                    "update",
                    "emit",
                    "spawn",
                    "kill",
                    "onKill",
                    "toSpec",
                    "stateSpec",
                    "afterSpawn",
                    "step",
                    "execute",
                    "handleAction",
                    "substituteInObject",
                ].includes(key)
            );

        const allCommands = [...builtInCommands, ...protoCommands];

        this.emit({ help: allCommands });
        return allCommands;
    },
});
