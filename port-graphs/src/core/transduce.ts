import type {
    Arrow,
    Morphism,
    Gadget,
    InputOf,
    Memory,
    Pipe,
    Choose,
    BiPredicate,
} from './types';

export const contramapInput = <A, B1, B2, C>(
    f: Morphism<B2, B1>,
    arrow: Arrow<A, B1, C>
): Arrow<A, B2, C> =>
    (a, b2) => arrow(a, f(b2));

export const pipe = <A, B, C, D>(
    arrow: Arrow<A, B, C>,
    morphism: Morphism<C, D>
) => (a: A, b: B) => morphism(arrow(a, b));

export const choose = <A, B, C>(
    predicate: BiPredicate<A, B>,
    ifTrue: Arrow<A, B, C>,
    ifFalse: Arrow<A, B, C>
) => (a: A, b: B) => predicate(a, b) ? ifTrue(a, b) : ifFalse(a, b);

export const sequence = <A, B, C, D>(
    first: Arrow<A, B, C>,
    bridge: Morphism<C, B>,
    second: Arrow<A, B, D>
): Arrow<A, B, D> =>
    (a, b) => second(a, bridge(first(a, b)));

export const mapOutput = <A, B, C1, C2>(
    arrow: Arrow<A, B, C1>,
    f: Morphism<C1, C2>
): Arrow<A, B, C2> =>
    (a, b) => f(arrow(a, b));

export const memory = <T>(initial: T): Memory<T> => {
    let current = initial;
    return {
        get: () => current,
        set: (val: T) => { current = val; }
    };
};

const merge = <T>(data: T) => ({ kind: 'merge', data } as const);
const ignore = () => ({ kind: 'ignore' } as const);

export const maxStep = (curr: number, val: number) => val > curr ? merge(val) : ignore();

// ============================================
// Run Helper (Runtime)
// ============================================

export const run = <S extends Arrow<any, any, any>>(
    g: Gadget<S>
) => (input: InputOf<S>) => {
    const state = g.source();
    const output = g.step(state, input);
    g.sink(output);
}

type Context<S, I, O> = (step: Arrow<S, I, O>, sink: (output: O) => void) => Gadget<Arrow<S, I, O>>;