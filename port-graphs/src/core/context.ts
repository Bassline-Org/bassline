// ================================================
// Core
// ================================================

export * from './reactStore';

export function protoGadget<S, I, A>(step: Arrow<S, I, A>) {
    return {
        handler<E>(handler: Handler<S, A, E>) {
            return {
                step,
                handler,
            } as const satisfies ProtoGadget<S, I, A, E>
        }
    } as const
}

// @goose: Realizes a proto-gadget into a full gadget, by passing a store for state
export function realize<S, I, A, E>(p: ProtoGadget<S, I, A, E>, store: Store<S>, emit: Emitter<E>) {
    const g = {
        emit,
        receive(input: I) {
            const actions = this.step(this.current(), input);
            if (actions !== undefined) {
                const effects = this.handler(this, actions);
                if (effects !== undefined) {
                    this.emit(effects)
                }
            }
        },
        ...p,
        ...store,
    } as const satisfies Gadget<S, I, A, E>;
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
export const quick = <S, I, A, E>(
    proto: ProtoGadget<S, I, A, E>,
    initial: S,
    emit: Emitter<E> = (e: E) => { }
) => realize(proto, memoryStore<S>(initial), emit);

// ================================================
// Types
// ================================================
export type Arrow<A, B, C> = (a: A, b: B) => C;
export type StateOf<F> = F extends Arrow<infer State, infer Input, infer Actions> ? State : never;
export type InputOf<F> = F extends Arrow<infer State, infer Input, infer Actions> ? Input : never;
export type ActionsOf<F> = F extends Arrow<infer State, infer Input, infer Actions> ? Actions : never;
export type HandlerContext<S> = Store<S>;
export type Handler<S, A, E> = (g: HandlerContext<S>, actions: A) => E;
export type Emitter<E> = (effects: E) => void;

export type Store<State> = {
    current(): State;
    update(updated: State): void;
}

export type Emit<E> = {
    emit: Emitter<E>
}

export type Receive<I> = {
    receive(input: I): void
}
export type Step<S, I, A> = {
    step: Arrow<S, I, A>
}
export type Handles<S, A, E> = {
    handler: Handler<S, A, E>
}

export type ProtoGadget<S, I, A, E> = Step<S, I, A> & Handles<S, A, E>

export type Gadget<S, I, A, E> =
    & Step<S, I, A>
    & Handles<S, A, E>
    & Store<S>
    & Emit<E>
    & Receive<I>

export type CellActions<T> = {
    merge?: T,
    ignore?: {}
}

// ================================================
// Extensions
// ================================================

// @goose: Type for tap functions that observe effects
export type TapFn<A> = (actions: A) => void;

// @goose: Interface for tappable gadgets
export type Tappable<E> = {
    tap(fn: TapFn<E>): () => void;
}

// @goose: Type guard for tappable gadgets
export function isTappable<S, I, A, E>(
    gadget: Gadget<S, I, A, E>
): gadget is Gadget<S, I, A, E> & Tappable<E> {
    return 'tap' in gadget && typeof gadget.tap === 'function';
}

// @goose: Add tapping capability to a gadget by wrapping its handler
export function withTaps<S, I, A, E>(
    gadget: Gadget<S, I, A, E>
): Gadget<S, I, A, E> & Tappable<E> {
    if (isTappable(gadget)) return gadget;

    const taps = new Set<TapFn<E>>();
    const originalEmit = gadget.emit;

    gadget.emit = (effects: E) => {
        originalEmit(effects);
        taps.forEach(fn => fn(effects));
    };

    // Add tap method
    return Object.assign(gadget, {
        tap: (fn: TapFn<E>) => {
            taps.add(fn);
            return () => taps.delete(fn);
        }
    });
}