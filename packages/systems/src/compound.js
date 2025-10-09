import { bl, fromSpec } from "@bassline/core";
import { scope } from "@bassline/core";
import { localRef } from "@bassline/refs";

const { gadgetProto } = bl();

const pkg = "@bassline/compound";

export const compound = Object.create(gadgetProto);
Object.assign(compound, {
    pkg,
    name: "compound",
    defaultState() {
        return {};
    },
    afterSpawn(initial) {
        const initialState = { ...this.defaultState(), ...initial };
        const s = scope();
        s.enter(() => {
            for (const [name, value] of Object.entries(initialState)) {
                if (value?.pkg && value?.name) {
                    const gadget = fromSpec(value);
                    s.set(name, gadget);
                } else {
                    console.warn(
                        `${name}: expected gadget or spec, got ${typeof value}. ` +
                            `Wrap primitives in gadgets (e.g., unsafe.last.spawn(${value}))`,
                    );
                }
            }
        });
        this.update(s);
    },
    step(state, input) {
        state.enter(() => {
            for (const [name, value] of Object.entries(input)) {
                if (name === "bind" && state[name] === undefined) {
                    for (const [k, v] of Object.entries(value) || []) {
                        // if it's a gadget, bind it in the scope
                        if (gadgetProto.isPrototypeOf(v)) {
                            state.set(k, v);
                            continue;
                        }
                        // if it's a spec, create a gadget from it
                        if (v.pkg && v.name) {
                            state.set(k, fromSpec(v));
                            continue;
                        }
                    }
                    continue;
                }
                const gadget = state.get(name);
                Promise.resolve(gadget).then((g) => {
                    g.receive(value);
                });
            }
        });
    },
    validate(input) {
        if (typeof input !== "object" || input === null) return undefined;
        return input;
    },
    stateSpec() {
        const scope = this.current();
        const gadgets = {};

        for (const [name, gadget] of Object.entries(scope)) {
            if (name.startsWith("_")) continue;
            gadgets[name] = gadget.toSpec();
        }

        return gadgets;
    },
    get(name) {
        return this.current().get(name);
    },
    getMany(names) {
        return names.map((name) => this.get(name));
    },
});

export function defineCompound({ pkg, name, state }) {
    const g = Object.create(compound);
    Object.assign(g, {
        pkg,
        name,
        defaultState() {
            return state;
        },
    });
    return g;
}
