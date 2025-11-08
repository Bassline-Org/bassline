import {
    hash,
    isWildcard,
    PatternVar,
    validateType,
    WC,
    Word,
    word as w,
} from "../types.js";
import { v4 } from "uuid";
import { valuesEqual } from "../minimal-graph.js";

export class Quad {
    constructor(entity, attribute, value, group = autoGroup()) {
        this.values = [
            quadValue(entity, "Entity"),
            quadValue(attribute, "Attribute"),
            quadValue(value, "Value"),
            quadValue(group, "Group"),
        ];
    }
    hash() {
        return toKey(this.values);
    }
}

const quadValue = (value, usage = "Value") => {
    if (
        value instanceof Word ||
        typeof value === "number" ||
        typeof value === "string"
    ) {
        return value;
    }
    throw new Error(`Invalid ${usage}: ${value}`);
};

export const autoGroup = () => w(`e:${v4()}`);

export const quad = (entity, attribute, value, group) =>
    new Quad(entity, attribute, value, group);

export const toKey = ([head, ...tail]) =>
    tail.reduce((acc, value, index) => hash(value) ^ (acc + index), hash(head));

// function test() {
//     const ctx = w("foo-context");
//     const a = quad(w("foo"), w("bar"), 123, ctx);
//     const b = pattern(
//         patternQuad(w("foo"), v("attr"), 123, ctx),
//         patternQuad(v("e"), v("a"), v("v"), ctx),
//     );
//     const [doesMatch, bindings] = b.match(a);
//     console.log("Matches: ", doesMatch);
//     console.log("Bindings: ", bindings);
// }

// test();
