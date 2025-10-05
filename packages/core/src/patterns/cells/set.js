import { Gadget } from "../../gadget.js";

function asSet(input) {
    if (input instanceof Set) return input;
    if (Array.isArray(input)) return new Set(input);
    return new Set([input]);
}

function unionStep(current, input) {
    const validated = asSet(input);
    if (validated === undefined) return;
    if (validated.isSubsetOf(current)) return;
    this.update(current.union(validated));
}

function intersectionStep(current, input) {
    const validated = asSet(input);
    if (validated === undefined) return;
    if (current.size === 0) {
        this.update(validated);
        return;
    }

    const intersection = current.intersection(validated);
    if (intersection.size === 0) {
        const handler = this.contradiction;
        if (handler === undefined) throw new Error("No contradiction handler!");
        handler(current, validated);
    }

    if (intersection.size === current.size) return;
    this.update(intersection);
}

export function intersection(initial, onContradiction) {
    const cell = new Gadget(intersectionStep, new Set(initial));
    cell.contradiction = onContradiction;
    return cell;
}

export function union(initial) {
    return new Gadget(unionStep, new Set(initial));
}
