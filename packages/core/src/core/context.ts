import { withTaps } from "./extensions";
import { Arrow, Emitter, Gadget, Handler, ProtoGadget, Store, TapFn, Tappable } from "./types";
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
) => withTaps(realize(proto, memoryStore<S>(initial), emit));