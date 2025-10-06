import { gadgetProto } from "../../gadget.js";

const setProto = Object.create(gadgetProto);
setProto.contradiction = function ({ current, incoming }) {
    console.log("Contradiction! ", current, incoming);
};

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
        this.contradiction({ current, incoming: validated });
    }

    if (intersection.size === current.size) return;
    this.update(intersection);
}

export function Intersection(initial = new Set(), onContradiction) {
    this.step = intersectionStep.bind(this);
    if (onContradiction) this.contradiction = onContradiction;
    this.update(initial);
}
Intersection.prototype = setProto;

export function Union(initial = new Set()) {
    this.step = unionStep.bind(this);
    this.update(initial);
}
Union.prototype = setProto;
