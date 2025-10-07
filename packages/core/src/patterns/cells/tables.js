import { bl } from "../../index.js";
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
        if (shouldFlatten && value instanceof gadgetProto) {
            return value.current();
        } else {
            return value;
        }
    },
    set(vals, shouldForward = true) {
        const toReceive = {};
        for (const [key, value] of entries(vals)) {
            const current = this.get(key);
            if (current instanceof gadgetProto && shouldForward) {
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
        const validated = this.prototype.validate.call(this, input);
        if (validated === undefined) return undefined;
        return validated.map(([key, value]) =>
            value instanceof gadgetProto
                ? [key, value]
                : [key, this.factory.spawn(value)]
        );
    },
    factory: ordinal,
    name: "firstWithCells",
});

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
