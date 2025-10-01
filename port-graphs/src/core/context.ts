// ================================================
// Core
// ================================================
export function protoGadget<S, I, A>(step: Arrow<S, I, A>) {
    return {
        handler<E extends Record<string, any>>(handler: Handler<S, A, E>) {
            return {
                step,
                handler,
            } as const satisfies ProtoGadget<S, I, A, E>
        }
    } as const
}

// @goose: Realizes a proto-gadget into a full gadget, by passing a store for state
export function realize<S, I, A, E extends Record<string, any>>(p: ProtoGadget<S, I, A, E>, store: Store<S>, emit: Emitter<E>) {
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
export const quick = <S, I, A, E extends Record<string, any>>(
    proto: ProtoGadget<S, I, A, E>,
    initial: S,
    emit: Emitter<E> = (effects: Partial<E>) => { }
) => realize(proto, memoryStore<S>(initial), emit);

// ================================================
// Types
// ================================================

// @goose: Utility type to convert union to intersection
export type UnionToIntersection<U> = (
    U extends any ? (x: U) => void : never
) extends (x: infer I) => void ? I : never;

// @goose: Merge multiple effect records into a single record with optional fields
// Each key becomes optional and its type is the union of all possible types for that key
export type MergeEffects<E1, E2> = {
    [K in keyof E1 | keyof E2]?:
    (K extends keyof E1 ? E1[K] : never) |
    (K extends keyof E2 ? E2[K] : never)
};

export type Arrow<A, B, C> = (a: A, b: B) => C;
export type StateOf<F> = F extends Arrow<infer State, infer Input, infer Actions> ? State : never;
export type InputOf<F> = F extends Arrow<infer State, infer Input, infer Actions> ? Input : never;
export type ActionsOf<F> = F extends Arrow<infer State, infer Input, infer Actions> ? Actions : never;

// @goose: Extract effects type from handler
export type EffectsOf<H> = H extends Handler<any, any, infer E> ? E : never;

export type HandlerContext<S> = Store<S>;

// @goose: Handler type with constrained record effects
// - Actions: Can be any shape that extends AMin (open/contravariant)
// - Effects: Must be a record type for clean composition (constrained)
// Handlers return Partial<Effects> since any subset of effects can be emitted
export type Handler<S, AMin, Effects extends Record<string, any>> = (
    g: HandlerContext<S>,
    actions: AMin
) => Partial<Effects>;

export type Emitter<E> = (effects: Partial<E>) => void;

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
export type Handles<S, A, E extends Record<string, any>> = {
    handler: Handler<S, A, E>
}

export type ProtoGadget<S, I, A, E extends Record<string, any>> = Step<S, I, A> & Handles<S, A, E>

export type Gadget<S, I, A, E extends Record<string, any>> =
    & Step<S, I, A>
    & Handles<S, A, E>
    & Store<S>
    & Emit<E>
    & Receive<I>

// ================================================
// Protocol Helpers - Behavioral Constraints
// ================================================

// @goose: Constrain a gadget by what it accepts as input
// Use when you only care about what commands/data a gadget accepts
export type Accepts<I> = Gadget<any, I, any, any>;

// @goose: Constrain a gadget by what effects it emits
// Use when you only care about observing a gadget's behavior
// Note: Includes Tappable since observing requires tapping
export type Emits<E extends Record<string, any>> =
    Gadget<any, any, any, E> & Tappable<E>;

// @goose: Constrain a gadget by its full behavioral contract (input + effects)
// Use when you need to both send commands AND observe effects
export type Protocol<I, E extends Record<string, any>> =
    Gadget<any, I, any, E> & Tappable<E>;

// @goose: Protocol shape - defines behavioral contract independently of implementation
// This is the interface you implement to define reusable behavioral patterns
export interface ProtocolShape<I, E extends Record<string, any>> {
    input: I;
    effects: E;
}

// @goose: Convert a protocol shape to a gadget constraint
// Use this to constrain generic parameters to specific behavioral contracts
export type Implements<P extends ProtocolShape<any, any>> =
    P extends ProtocolShape<infer I, infer E>
    ? Protocol<I, E>
    : never;

// @goose: Compose two protocols (union of inputs, intersection of effects)
// A gadget implementing And<P1, P2> accepts either P1 or P2 inputs
// and emits both P1 AND P2 effects
export type And<
    P1 extends ProtocolShape<any, any>,
    P2 extends ProtocolShape<any, any>
> = ProtocolShape<
    P1['input'] | P2['input'],
    P1['effects'] & P2['effects']
>;

// ================================================
// Extensions
// ================================================

// @goose: Type for tap functions that observe effects
export type TapFn<E> = (effects: Partial<E>) => void;

// @goose: Interface for tappable gadgets
export type Tappable<E> = {
    tap(fn: TapFn<E>): () => void;
}

// @goose: Type guard for tappable gadgets
export function isTappable<S, I, A, E extends Record<string, any>>(
    gadget: Gadget<S, I, A, E>
): gadget is Gadget<S, I, A, E> & Tappable<E> {
    return 'tap' in gadget && typeof gadget.tap === 'function';
}

// @goose: Add tapping capability to a gadget by wrapping its handler
export function withTaps<S, I, A, E extends Record<string, any>>(
    gadget: Gadget<S, I, A, E>
): Gadget<S, I, A, E> & Tappable<E> {
    if (isTappable(gadget)) return gadget;

    const taps = new Set<TapFn<E>>();
    const originalEmit = gadget.emit;

    gadget.emit = (effects: Partial<E>) => {
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