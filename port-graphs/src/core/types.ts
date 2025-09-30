// ============================================
// Core Algebraic Types
// ============================================

export type Morphism<A, B> = (a: A) => B;
export type Endomorphism<A> = Morphism<A, A>;
export type Isomorphism<A, B> = {
    to: Morphism<A, B>;
    from: Morphism<B, A>;
};

export type Arrow<A, B, C> = (a: A, b: B) => C;

export type Predicate<A> = Morphism<A, boolean>;
export type BiPredicate<A, B> = Arrow<A, B, boolean>;

// ============================================
// Functor & Profunctor Types
// ============================================

export interface Functor<F> {
    map<A, B>(fa: F & { _tag: A }, f: Morphism<A, B>): F & { _tag: B };
}

// Contravariant functor
export interface Contravariant<F> {
    contramap<A, B>(fa: F & { _tag: A }, f: Morphism<B, A>): F & { _tag: B };
}

// Profunctor: contravariant in first arg, covariant in second
export interface Profunctor<P> {
    dimap<A, B, C, D>(
        pab: P & { _in: A; _out: B },
        f: Morphism<C, A>,
        g: Morphism<B, D>
    ): P & { _in: C; _out: D };
}

// ============================================
// Gadget Type System
// ============================================

// Gadget parameterized by its step function type
export type Gadget<S> = S extends Arrow<infer State, infer Input, infer Output> ? {
    source(): State;
    step: S;
    sink(output: Output): void;
} : never;

// Type extractors
export type StateOf<S> = S extends Arrow<infer State, any, any> ? State : never;
export type InputOf<S> = S extends Arrow<any, infer Input, any> ? Input : never;
export type OutputOf<S> = S extends Arrow<any, any, infer Output> ? Output : never;

// Extract spec from gadget
export type SpecOf<G> = G extends Gadget<infer S> ? S : never;

// ============================================
// Morphism Combinator Types
// ============================================

// Transform first argument (contravariant)
export type ContramapFirst<A1, A2, B, C> =
    (f: Morphism<A2, A1>, arrow: Arrow<A1, B, C>) => Arrow<A2, B, C>;

// Transform second argument (contravariant)
export type ContramapSecond<A, B1, B2, C> =
    (f: Morphism<B2, B1>, arrow: Arrow<A, B1, C>) => Arrow<A, B2, C>;

// Transform output (covariant)
export type MapOutput<A, B, C1, C2> =
    (arrow: Arrow<A, B, C1>, f: Morphism<C1, C2>) => Arrow<A, B, C2>;

// Full profunctor dimap
export type Dimap<A1, A2, B1, B2, C1, C2> =
    (fa: Morphism<A2, A1>, fb: Morphism<B2, B1>, fc: Morphism<C1, C2>, arrow: Arrow<A1, B1, C1>) => Arrow<A2, B2, C2>;

// ============================================
// Composition Pattern Types
// ============================================

// Parallel composition
export type Parallel<A, B, C, D> =
    (arrow1: Arrow<A, B, C>, arrow2: Arrow<A, B, D>) => Arrow<A, B, [C, D]>;

// Sequential composition with bridge
export type Sequence<A, B, C, D> =
    (first: Arrow<A, B, C>, bridge: Morphism<C, B>, second: Arrow<A, B, D>) => Arrow<A, B, D>;

// Choice composition
export type Choose<A, B, C> =
    (predicate: BiPredicate<A, B>, ifTrue: Arrow<A, B, C>, ifFalse: Arrow<A, B, C>) => Arrow<A, B, C>;

// Pipe composition
export type Pipe<A, B, C, D> =
    (arrow: Arrow<A, B, C>, morphism: Morphism<C, D>) => Arrow<A, B, D>;

// ============================================
// Lens Types
// ============================================

export type Lens<S, A> = {
    get: Morphism<S, A>;
    set: (s: S, a: A) => S;
};

export type LensedArrow<S, A, B, C> =
    (lens: Lens<S, A>, arrow: Arrow<A, B, C>) => Arrow<S, B, C>;

export type PropLens<S, K extends keyof S> = Lens<S, S[K]>;

export type Memory<T> = {
    get(): T;
    set(value: T): void;
};

export type Context<T> = Memory<T> & {
    update(f: Endomorphism<T>): void;
};

// ============================================
// Builder Types
// ============================================

export type GadgetBuilder<S extends Arrow<any, any, any>> =
    (step: S, initial: StateOf<S>) => Gadget<S>;

export type WithMemory<S extends Arrow<any, any, any>> =
    (step: S, memory: Memory<StateOf<S>>) => Gadget<S>;