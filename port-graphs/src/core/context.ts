// ================================================
// Core
// ================================================

// @goose: Defines a new proto gadget from a step
export function protoGadget<Step extends Arrow>(step: Step) {
    return {
        handler(handler: Handler<Step>) {
            return {
                step,
                handler,
            } as const satisfies ProtoGadget<Step>
        }
    } as const
}

// @goose: Realizes a proto-gadget into a full gadget, by passing a store for state
export function realize<Step extends Arrow>(p: ProtoGadget<Step>, store: Store<StateOf<Step>>) {
    const g = {
        receive(input) {
            const effects = g.step(g.current(), input);
            if (effects !== undefined) {
                g.handler(g, effects)
            }
        },
        ...p,
        ...store,
    } as const satisfies Gadget<Step>;
    return g as typeof g;
}

// @goose: A semilattice ordered by the >= relation
export const maxStep = (a: number, b: number) => b >= a ? { merge: b } as const : { ignore: {} } as const;

// @goose: A semilattice ordered by isSubsetOf relation
export const unionStep = <T>() => (a: Set<T>, b: Set<T>) => b.isSubsetOf(a) ? { ignore: {} } as const : { merge: a.union(b) } as const;

// @goose: A semilattice ordered by intersection
export const intersectionStep = <T>() => (a: Set<T>, b: Set<T>) => {
    const intersection = a.intersection(b);
    if (intersection.size === 0) {
        return { contradiction: { current: a, incoming: b } } as const;
    }
    if (intersection.size === a.size) {
        return { ignore: {} } as const;
    }
    return { merge: intersection } as const;
}

// ================================================
// Handlers
// ================================================

// @goose: Handler for merging values
export const mergeHandler = <Step extends Arrow>() => (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if (effects && 'merge' in effects) g.update(effects.merge)
}

// @goose: Handler for contradiction
export const contradictionHandler = <Step extends Arrow>() => (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if (effects && 'contradiction' in effects) console.log('contradiction!', effects.contradiction);
}

// @goose: Compose multiple handlers into a single handler
export const composeHandlers = <Step extends Arrow>(
    ...handlers: Handler<Step>[]
): Handler<Step> => (g, effects) => {
    handlers.forEach(h => h(g, effects));
};

// ================================================
// Stores
// ================================================

// @goose: In memory store, most dumb store
export const memoryStore = <T>(initial: T): Store<T> => {
    let state = initial;
    return {
        current: () => state,
        update: (newState) => state = newState,
    } as const satisfies Store<T>
}

// @goose: Quick realization with a default memory store
export const quick = <Step extends Arrow>(
    proto: ProtoGadget<Step>,
    initial: StateOf<Step>
) => realize(proto, memoryStore<StateOf<Step>>(initial));

const fooProto = protoGadget(maxStep).handler(mergeHandler);

// ================================================
// Types
// ================================================
export type Arrow<A = any, B = any, C = any> = (a: A, b: B) => C;
export type StateOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? State : never;
export type InputOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? Input : never;
export type EffectsOf<F> = F extends Arrow<infer State, infer Input, infer Effects> ? Effects : never;
export type Handler<F extends Arrow, G extends Gadget<F> = Gadget<F>> = (g: G, effects: EffectsOf<F>) => void;
export type Store<State> = {
    current(): State;
    update(updated: State): void;
}
export type ProtoGadget<Step extends Arrow> = {
    step: Step
    handler: Handler<Step>
}
export type Gadget<Step extends Arrow> =
    & ProtoGadget<Step>
    & Store<StateOf<Step>>
    & { receive(input: InputOf<Step>): void }

export type CellEffects<T> = {
    merge?: T,
    ignore?: {}
}

// ================================================
// Extensions
// ================================================

// @goose: Type for tap functions that observe effects
export type TapFn<Step extends Arrow> = (effects: EffectsOf<Step>) => void;

// @goose: Interface for tappable gadgets
export type Tappable<Step extends Arrow> = {
    tap(fn: TapFn<Step>): () => void;
}

// @goose: Type guard for tappable gadgets
export function isTappable<Step extends Arrow>(
    gadget: Gadget<Step>
): gadget is Gadget<Step> & Tappable<Step> {
    return 'tap' in gadget && typeof gadget.tap === 'function';
}

// @goose: Add tapping capability to a gadget by wrapping its handler
export function withTaps<Step extends Arrow>(
    gadget: Gadget<Step>
): Gadget<Step> & Tappable<Step> {
    if (isTappable(gadget)) return gadget;

    const taps = new Set<TapFn<Step>>();
    const originalHandler = gadget.handler;

    // Wrap handler to broadcast effects to all taps
    gadget.handler = (g: Gadget<Step>, effects: EffectsOf<Step>) => {
        originalHandler(g, effects);
        taps.forEach(fn => fn(effects));
    };

    // Add tap method
    return Object.assign(gadget, {
        tap: (fn: TapFn<Step>) => {
            taps.add(fn);
            return () => taps.delete(fn);
        }
    });
}