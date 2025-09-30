// ================================================
// Core
// ================================================

export * from './reactStore';

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
            const effects = this.step(this.current(), input);
            if (effects !== undefined) {
                this.handler(this, effects)
            }
        },
        ...p,
        ...store,
    } as const satisfies Gadget<Step>;
    return g as typeof g;
}

// @goose: Helper for building cell steps with a predicate
export const cellStep = <T, E extends CellEffects<T>>({
    predicate,
    ifTrue = (a: T, b: T) => ({ merge: b } as E),
    ifFalse = (a: T, b: T) => ({ ignore: {} } as E)
}: {
    predicate: Arrow<T, T, boolean>,
    ifTrue?: Arrow<T, T, E>,
    ifFalse?: Arrow<T, T, E>
}) => (a: T, b: T) => predicate(a, b) ? ifTrue(a, b) : ifFalse(a, b);

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