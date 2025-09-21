
export type CellSpec<State, Input> = {
    state: State;
    input: Input;
    actions: {
        merge: Input;
    },
    effects: {
        changed: { newState: State, delta: Input };
    }
}

export * from './numeric';
export * from './set';
export { unionCell as arrayUnionCell, intersectionCell as arrayIntersectionCell } from './array-set';
export * from './predicates';
export * from './last';
export * from './maps';
export * from './position';
export * from './collections';
export { mapCell } from './mapCell';