import _ from "lodash";
import { createGadget } from "../../core";
import { changed, noop } from "../../effects";

export const binary = <A, B, R>(fn: (a: A, b: B) => R) => {
    type Args = { a: A, b: B };
    type Incoming = Partial<Args>;
    return createGadget(({ a, b }: Args, incoming: Incoming) => {
        const anyMissing = _.isUndefined(a) || _.isUndefined(b);
        const allBound = !anyMissing;

        if (allBound && Object.keys(incoming).length !== 0) return 'run';
        if (incoming.a && _.isUndefined(b)) return 'run';

        if (a && b && Object.keys(incoming).length !== 0) return 'run';
        if (incoming.a) {
        }
    })({
        'true': (gadget, { a, b }) => {
            const result = fn(a, b);
            if (result === gadget.current()) return noop();
            gadget.update(result);
            return changed(result);
        },
        'false': (_gadget, _a, _b) => noop()
    });
}