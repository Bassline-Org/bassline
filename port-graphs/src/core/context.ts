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

type CellEffects<T> = {
    merge?: T,
    ignore?: {}
}

// @goose: Some default steps
export const cellStep = <T, E extends CellEffects<T>>({
    predicate,
    ifTrue = (a: T, b: T) => ({ merge: b } as E),
    ifFalse = (a: T, b: T) => ({ ignore: {} } as E)
}: {
    predicate: Arrow<T, T, boolean>,
    ifTrue?: Arrow<T, T, E>,
    ifFalse?: Arrow<T, T, E>
}) => (a: T, b: T) => predicate(a, b) ? ifTrue(a, b) : ifFalse(a, b);

export const maxStep = cellStep({
    predicate: (a: number, b: number) => a > b,
})

export const unionStep = <T>() => cellStep({
    predicate: (a: Set<T>, b: Set<T>) => b.isSubsetOf(a),
    ifTrue: (a: Set<T>, b: Set<T>) => ({ merge: a.union(b) }),
})

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

export const composeHandlers = <Step extends Arrow>(
    ...handlers: Handler<Step>[]
): Handler<Step> => (g, effects) => {
    handlers.forEach(h => h(g, effects));
};

export const mergeHandler = <Step extends Arrow>() => (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if ('merge' in effects) g.update(effects.merge)
}
export const contradictionHandler = <Step extends Arrow>() => (g: Gadget<Step>, effects: EffectsOf<Step>) => {
    if ('contradiction' in effects) {
        console.log('contradiction!', effects.contradiction);
    }
}

export const protoMax = protoGadget(maxStep)
    .handler(mergeHandler<typeof maxStep>());

export const protoIntersection = <T>() => {
    const step = intersectionStep<T>();
    return protoGadget(step)
        .handler(composeHandlers<typeof step>(
            contradictionHandler<typeof step>(),
            mergeHandler<typeof step>()
        ));
}

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