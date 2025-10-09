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

    afterSpawn(initial) {
        this.receive(initial);
    },

    step(state, input) {
        this.execute(input).catch((err) => {
            console.error("Sexecution failed:", err);
        });
    },

    async execute(actions) {
        const env = {
            spawned: {},
            vals: {},
        };

        for (const [action, ...rest] of actions) {
            await this.handleAction(env, action, ...rest);
        }

        this.emit({ completed: { ...env, timestamp: Date.now() } });
    },

    async handleAction(env, action, ...rest) {
        switch (action) {
            case "spawn": {
                const [localName, { pkg, name, state }] = rest;
                const g = await fromSpec({ pkg, name, state });
                env.spawned[localName] = g;
                break;
            }

            case "ref": {
                const [names, doAction] = rest;
                const substituted = this.substitute(env, names, doAction);
                await this.handleAction(env, ...substituted);
                break;
            }

            case "send": {
                const [target, value] = rest;
                if (gadgetProto.isPrototypeOf(target)) {
                    target.receive(value);
                    break;
                }
                const gadget = env.spawned[target];
                if (!gadget) throw new Error(`Unknown target: ${target}`);
                gadget.receive(value);
                break;
            }
            default: {
                console.warn(`Unknown action: ${action}`);
                break;
            }
        }
    },

    substitute(env, names, action) {
        const [actionName, ...args] = action;

        const substitutedArgs = args.map((arg, i) => {
            if (typeof arg === "string" && names.includes(arg)) {
                return env.spawned[arg];
            }
            if (typeof arg === "object" && arg !== null) {
                return this.substituteInObject(env, names, arg);
            }
            return arg;
        });

        return [actionName, ...substitutedArgs];
    },

    substituteInObject(env, names, obj) {
        if (Array.isArray(obj)) {
            return obj.map((item) => this.substituteInObject(env, names, item));
        }

        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "string" && names.includes(value)) {
                result[key] = env.spawned[value];
            } else if (typeof value === "object" && value !== null) {
                result[key] = this.substituteInObject(env, names, value);
            } else {
                result[key] = value;
            }
        }
        return result;
    },
});
