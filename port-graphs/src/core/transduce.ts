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

export const merge = <T>(value: T) => ({ merge: value } as const);
export const ignore = () => ({ ignore: {} } as const);
export const emit = <E>(event: E, data?: any) => ({ emit: { event, data } } as const);
export const error = (msg: string) => ({ error: msg } as const);

export const cellStep = <A, B>(check: Arrow<A, B, boolean>) =>
    (curr: A, val: B) => check(curr, val) ? merge(val) : ignore();
export const maxStep = cellStep((curr: number, val: number) => val > curr);
export const minStep = cellStep((curr: number, val: number) => val < curr);
export const unionStep = <T>() => cellStep((curr: Set<T>, vals: Set<T>) => !vals.isSubsetOf(curr));

const memory = <T>(initial: T) => {
    let current = initial;
    return {
        get: () => current,
        set: (val: T) => {
            current = val;
        }
    } as const;
}

const gadget = <S, C>(step: S, context: C, fn: Arrow<S, C, Gadget<S>>): Gadget<S> => {
    return fn(step, context);
}

const max = gadget(maxStep, memory(0), (step, context) => {
    return {
        source: context.get,
        step,
        sink: (e) => {
            if ('merge' in e) {
                console.log('merge', e.merge);
                context.set(e.merge);
            }
            if ('ignore' in e) {
                console.log('ignore');
            }
        }
    }
})