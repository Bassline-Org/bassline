import { hash, Word, Ref, word as w } from "../types.js";

// Fast auto-group using incrementing counter instead of UUID
let groupCounter = 0;

export class Quad {
    constructor(entity, attribute, value, group) {
        this.values = [
            quadValue(entity, "Entity"),
            quadValue(attribute, "Attribute"),
            quadValue(value, "Value"),
            quadValue(group ?? autoGroup(), "Group"),
        ];
        // Cache hash on creation for O(1) lookup
        this._hash = toKey(this.values);
    }
    get entity() {
        return this.values[0];
    }
    get attribute() {
        return this.values[1];
    }
    get value() {
        return this.values[2];
    }
    get context() {
        return this.values[3];
    }
    hash() {
        return this._hash;
    }
}

const quadValue = (value, usage = "Value") => {
    if (
        value instanceof Word ||
        value instanceof Ref ||
        typeof value === "number" ||
        typeof value === "string"
    ) {
        return value;
    }
    throw new Error(`Invalid ${usage}: ${value}`);
};

export const autoGroup = () => w(`g:${groupCounter++}`);

export const quad = (entity, attribute, value, group) =>
    new Quad(entity, attribute, value, group);

export const toKey = ([head, ...tail]) =>
    tail.reduce((acc, value, index) => hash(value) ^ (acc + index), hash(head));
