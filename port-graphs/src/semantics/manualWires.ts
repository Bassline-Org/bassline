import { Gadget } from "../core";

export const wires = {
    directed: <From, To>(fromGadget: From, toGadget: To) => {
        const from = fromGadget as GadgetDetails<From>;
        const to = toGadget as GadgetDetails<To>;
        const oldEmit = from.emit;
        from.emit = (effect) => {
            const [kind, ...args] = effect;
            if (kind === 'changed') {
                to.receive(args[0]);
            }
            oldEmit(effect);
        }
    },
    bi: <From, To>(fromGadget: From, toGadget: To) => {
        const from = fromGadget as GadgetDetails<From>;
        const to = toGadget as GadgetDetails<To>;
        const fromEmit = from.emit;
        from.emit = (effect) => {
            const [kind, ...args] = effect;
            if (kind === 'changed') {
                to.receive(args[0]);
            }
            fromEmit(effect);
        }
        const toEmit = to.emit;
        to.emit = (effect) => {
            const [kind, ...args] = effect;
            if (kind === 'changed') {
                from.receive(args[0]);
            }
            toEmit(effect);
        }
    },
    // Meta-wires that route effects directly instead of just values
    effectDirected: <From, To>(fromGadget: From, toGadget: To) => {
        const from = fromGadget as GadgetDetails<From>;
        const to = toGadget as GadgetDetails<To>;
        const oldEmit = from.emit;
        from.emit = (effect) => {
            to.receive(effect);
            oldEmit(effect);
        }
    },
}

export type GadgetDetails<G> = G extends Gadget<infer Current, infer Incoming, infer Effect> ? Gadget & {
    current: Current;
    incoming: Incoming;
    effect: Effect;
    emit: G['emit'];
    receive: G['receive'];
    update: G['update'];
} : never;

// NOTE: This isn't used yet, was testing to see what kind of type inference we could get from our new implementation
export function compatibleEffects<F, T>(fromGadget: F, toGadget: T) {
    type FromEffects = GadgetDetails<F>['effect'];
    type ToEffects = GadgetDetails<T>['effect'];

    type CommonEffects = FromEffects & ToEffects;

    return [fromGadget as F & { emit: (effect: CommonEffects) => void },
    toGadget as T & { emit: (effect: CommonEffects) => void }] as const;
}