/// Sex: Sequential EXecution
/// Just a simple gadget that accepts in an array of actions and executes them sequentially
/// It doesn't store any persistent state, but during execution, it will keep a local environment
/// This can store gadgets and things
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
        this.receive(initial);
    },

    step(_state, input) {
        this.execute(input).catch((err) => {
            console.error("Sexecution failed:", err);
        });
    },

    async execute(actions) {
        const env = {
            spawned: {},
            vals: {},
            activeRefs: [],
            activeVals: [],
        };
        for (const [action, ...rest] of actions) {
            await this.handleAction(env, action, ...rest);
        }

        this.emit({ completed: { ...env, timestamp: Date.now() } });
    },

    async handleAction(env, action, ...rest) {
        switch (action) {
            case "spawn": {
                const [localName, spec] = rest;
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
                console.warn(`Unknown action: ${action}`);
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
});
