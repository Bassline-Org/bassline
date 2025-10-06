import { Gadget, gadgetProto } from "../../gadget.js";

function entries(input) {
    if (Array.isArray(input) && input.length === 2) {
        return [[input[0], input[1]]];
    }
    if (input instanceof Object) return Object.entries(input);
    if (input instanceof Map) return input.entries();
    return [];
}

export const tableProto = Object.create(gadgetProto);
tableProto.validate = entries;
tableProto.added = function (additions) {
    this.emit({ added: additions });
};
tableProto.get = function (key, shouldFlatten = false) {
    const value = this.current()[key];
    if (shouldFlatten && value instanceof Gadget) {
        return value.current();
    } else {
        return value;
    }
};
tableProto.set = function (vals, shouldForward = true) {
    const toReceive = {};
    for (const [key, value] of entries(vals)) {
        const current = this.get(key);
        if (current instanceof Gadget && shouldForward) {
            current.receive(value);
        } else {
            toReceive[key] = value;
        }
    }
    this.receive(toReceive);
};

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

export function First(initial, onAdded) {
    this.step = firstTableStep.bind(this);
    if (onAdded) this.added = onAdded;
    this.update(initial);
}
First.prototype = tableProto;
