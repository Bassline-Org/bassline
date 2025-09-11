import _ from "lodash";
import { createGadget } from "../../core";
import { changed, noop } from "../../effects";

export const binary = <A, B, R>(fn: (a: A, b: B) => R) => {
    type Args = { a: A, b: B, result: R };
    type Incoming = Partial<{ a: A, b: B }>;
    return createGadget((current: Partial<Args>, incoming: Incoming) => {
        // Check if we have all required values after this incoming data
        const hasA = !_.isUndefined(incoming.a) || !_.isUndefined(current.a);
        const hasB = !_.isUndefined(incoming.b) || !_.isUndefined(current.b);

        if (hasA && hasB) return 'run';
        return 'update';
    })({
        'run': (gadget, current, incoming) => {
            const merged = _.merge({}, current, incoming);
            const result = fn(merged.a!, merged.b!);
            const newState = { ...merged, result };
            gadget.update(newState);
            return changed(newState);
        },
        'update': (gadget, current, incoming) => {
            const merged = _.merge({}, current, incoming);
            gadget.update(merged);
            return noop();
        }
    });
}

export const adder = binary((a: number, b: number) => a + b);
export const subtractor = binary((a: number, b: number) => a - b);
export const multiplier = binary((a: number, b: number) => a * b);
export const divider = binary((a: number, b: number) => a / b);

// Example usage
const foo = adder({});
foo.receive({ a: 1 });
foo.receive({ b: 2 });
foo.receive({ a: 3, b: 4 });
foo.receive({ a: 5 });

const bar = multiplier({});