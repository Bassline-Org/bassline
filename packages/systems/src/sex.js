/// Sex: Sequential EXecution
/// Execute sequential actions in an environment
/// Useful for building compound gadgets
import { bl, fromSpec } from "@bassline/core"; // ← Need to import fromSpec

const { gadgetProto } = bl();

export const sex = Object.create(gadgetProto);
Object.assign(sex, {
    name: "sex",
    pkg: "@bassline/systems",
    validate(input) {
        if (Array.isArray(input)) {
            return input;
        }
        return undefined;
    },
    afterSpawn(initial) {
        this.update({});
        this.receive(initial);
    },

    step(state, input) {
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
        // Convert current spawned gadgets back to spawn actions
        const spawned = this.current();
        const actions = [];

        for (const [name, gadget] of Object.entries(spawned)) {
            actions.push(["spawn", name, gadget.toSpec()]);
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
                preview =
                    Object.keys(state).length === 0
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
