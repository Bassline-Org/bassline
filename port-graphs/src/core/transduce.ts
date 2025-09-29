// ============================================
// Core Types
// ============================================

type Arrow<A, B, C> = (a: A, b: B) => C;
type Sink<A> = (a: A) => void;
type Source<A> = () => A;
type Morphism<A, B> = (a: A) => B;

// Gadget parameterized by its step function
export type Gadget<S> = S extends Arrow<infer State, infer Input, infer Output> ? {
    source: Source<State>;
    step: S;
    sink: Sink<Output>;
} : never;

export type State<S> = S extends Arrow<infer State, infer Input, infer Output> ? State : never;
export type Input<S> = S extends Arrow<infer State, infer Input, infer Output> ? Input : never;
export type Effects<S> = S extends Arrow<infer State, infer Input, infer Output> ? Output : never;

// ============================================
// Effect Constructors
// ============================================

export type Effect<Kind = unknown, Data = unknown> = {
    kind: Kind;
    data: Data;
    map<T>(f: (data: Data) => T): Effect<Kind, T>;
}

export const createEffect = <Kind, Data>(kind: Kind, data: Data): Effect<Kind, Data> => {
    return {
        kind,
        data,
        map: (f) => createEffect(kind, f(data))
    }
}

type MergeEffect<T> = Effect<'merge', T>;
export const merge = <T>(data: T): MergeEffect<T> => createEffect('merge', data);

type IgnoreEffect = Effect<'ignore', {}>;
export const ignore = (): IgnoreEffect => createEffect('ignore', {});

export const contramapFirst = <A1, A2, B, C>(
    f: Morphism<A2, A1>,
    arrow: Arrow<A1, B, C>
): Arrow<A2, B, C> =>
    (a2, b) => arrow(f(a2), b);

export const contramapSecond = <A, B1, B2, C>(
    f: Morphism<B2, B1>,
    arrow: Arrow<A, B1, C>
): Arrow<A, B2, C> =>
    (a, b2) => arrow(a, f(b2));

export const dimap = <A1, A2, B1, B2, C1, C2>(
    fa: Morphism<A2, A1>,
    fb: Morphism<B2, B1>,
    fc: Morphism<C1, C2>,
    arrow: Arrow<A1, B1, C1>
): Arrow<A2, B2, C2> =>
    (a2, b2) => fc(arrow(fa(a2), fb(b2)));

export const pipe = <A, B, C, D>(
    arrow: Arrow<A, B, C>,
    morphism: Morphism<C, D>
): Arrow<A, B, D> =>
    (a, b) => morphism(arrow(a, b));

export const parallel = <A, B, C, D>(
    arrow1: Arrow<A, B, C>,
    arrow2: Arrow<A, B, D>
): Arrow<A, B, [C, D]> =>
    (a, b) => [arrow1(a, b), arrow2(a, b)];

export const sequence = <A, B, C, D>(
    arrow: Arrow<A, B, C>,
    bridge: Morphism<C, B>,
    next: Arrow<A, B, D>
): Arrow<A, B, D> =>
    (a, b) => {
        const c = arrow(a, b);
        return next(a, bridge(c));
    };

export const when = <A, B, C, D>(
    predicate: Arrow<A, B, boolean>,
    ifTrue: Arrow<A, B, C>,
    ifFalse: Arrow<A, B, D>
): Arrow<A, B, C | D> =>
    (a, b) => predicate(a, b) ? ifTrue(a, b) : ifFalse(a, b);

// ============================================
// Step Functions
// ============================================

// Generic cell step with custom predicates and effects
export const cellStep = <A, B>(
    check: Arrow<A, B, boolean>
): Arrow<A, B, Effect<'merge', B> | Effect<'ignore', {}>> =>
    (curr, val) => check(curr, val) ? merge(val) : ignore();

// Standard step functions
export const maxStep = (curr: number, val: number) => val > curr;
export const minStep = (curr: number, val: number) => val < curr;
export const unionStep = <T>() => (
    (curr: Set<T>, vals: Set<T>) => !vals.isSubsetOf(curr)
);

type NestedState = { counter: number; label: string };
export const maxOnCounter = contramapSecond((a: NestedState) => a.counter, maxStep);

// ============================================
// Context and Memory
// ============================================

export const memory = <T>(initial: T) => {
    let current = initial;
    return {
        get: () => current,
        set: (val: T) => { current = val; }
    } as const;
};

// ============================================
// Gadget Builder
// ============================================

export const gadget = <S, C>(
    step: S,
    context: C,
    builder: (step: S, context: C) => Gadget<S>
): Gadget<S> => builder(step, context);

export const maxGadget = (initial: number = -Infinity) => {
    const ctx = memory(initial);

    return gadget(maxStep, ctx, (step, context) => ({
        source: context.get,
        step,
        sink: (e) => {
            if ('merge' in e) {
                console.log('New max:', e.merge);
                context.set(e.merge);
            }
            if ('ignore' in e) {
                console.log('Value ignored');
            }
        }
    } as Gadget<typeof step>));
};

// ============================================
// Running Gadgets
// ============================================

export const run = <S extends Arrow<any, any, any>>(
    g: Gadget<S>
): (input: Input<S>) => void => {
    const gadget = g as {
        source: Source<State<S>>;
        step: S;
        sink: Sink<Effects<S>>;
    };

    return (input) => {
        const state = gadget.source();
        const effect = gadget.step(state, input);
        gadget.sink(effect);
    };
};