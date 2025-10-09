import { bl } from "@bassline/core";

bl();
import { ordinal } from "./versioned.js";

const { gadgetProto } = bl();

const pkg = "@bassline/cells/tables";

export const tableProto = Object.create(gadgetProto);
Object.assign(tableProto, {
    pkg,
    validate: entries,
    added(additions) {
        this.emit({ added: additions });
    },
    get(key, shouldFlatten = false) {
        const value = this.current()[key];
        if (shouldFlatten && gadgetProto.isPrototypeOf(value)) {
            return value.current();
        } else {
            return value;
        }
    },
    set(vals, shouldForward = true) {
        const toReceive = {};
        for (const [key, value] of entries(vals)) {
            const current = this.get(key);
            if (gadgetProto.isPrototypeOf(current) && shouldForward) {
                current.receive(value);
            }
        }
        this.receive(toReceive);
    },
});

export const first = Object.create(tableProto);
Object.assign(first, {
    step: firstTableStep,
    name: "first",
});

function firstTableStep(current, incoming) {
    const additions = [];
    for (const [key, value] of incoming) {
        if (current[key] === undefined) {
            additions.push([key, value]);
        }
    }
    const merged = Object.fromEntries(
        Object.entries(current).concat(additions),
    );
    this.update(merged);
    this.added(Object.fromEntries(additions));
}

export const firstWithCells = Object.create(first);
Object.assign(firstWithCells, {
    validate(input) {
        const proto = Object.getPrototypeOf(firstWithCells);
        const validated = proto.validate.call(this, input);
        if (validated === undefined) return undefined;
        return validated.map(([key, value]) =>
            gadgetProto.isPrototypeOf(value)
                ? [key, value]
                : [key, this.factory.spawn(value)]
        );
    },
    stateSpec() {
        const curr = {};
        for (const [key, value] of Object.entries(this.current())) {
            if (value.stateSpec) {
                curr[key] = value.stateSpec();
            } else {
                curr[key] = value;
            }
        }
        return curr;
    },
    afterSpawn(state) {
        const entries = Object.entries(state)
            .map(([key, value]) => {
                if (isSpec(value)) {
                    return [key, bl().fromSpec(value)];
                } else {
                    return [key, value];
                }
            });
        const obj = Object.fromEntries(entries);
        this.update(obj);
    },
    factory: ordinal,
    name: "firstWithCells",
});

function isSpec(value) {
    return (
        isNil(value["pkg"]) ||
        isNil(value["name"]) ||
        isNil(value["state"])
    );
}

function entries(input) {
    if (Array.isArray(input) && input.length === 2) {
        return [[input[0], input[1]]];
    }
    if (input instanceof Object) return Object.entries(input);
    if (input instanceof Map) return input.entries();
    return [];
}

export default {
    gadgets: {
        first,
        firstWithCells,
    },
};
