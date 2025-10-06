const { gadgetProto } = bl();

const setProto = Object.create(gadgetProto);
setProto.contradiction = function ({ current, incoming }) {
    console.log("Contradiction! ", current, incoming);
};
setProto.validate = asSet;

function asSet(input) {
    if (input instanceof Set) return input;
    if (Array.isArray(input)) return new Set(input);
    return new Set([input]);
}

function unionStep(current, input) {
    if (input.isSubsetOf(current)) return;
    this.update(current.union(input));
}

function intersectionStep(current, input) {
    if (input.isSubsetOf(current)) return;
    if (current.size === 0) {
        this.update(input);
        return;
    }
    const intersection = current.intersection(input);
    if (intersection.size === 0) {
        this.contradiction({ current, incoming: input });
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

export default {
    Union,
    Intersection,
};
