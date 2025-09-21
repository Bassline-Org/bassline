import { Gadget } from "../old/core";

export const noop = () => ({ noop: true } as const);
export const changed = <T>(value: NonNullable<T>) => ({ changed: value } as const);
export const contradiction = <Curr, Inc>(current: NonNullable<Curr>, incoming: NonNullable<Inc>) =>
    ({ contradiction: { current, incoming } } as const);
export const creation = (gadget: Gadget) => ({ creation: gadget } as const);

export const effects = {
    noop,
    changed,
    contradiction,
    creation,
}

export type ChangedEffect<T> = ReturnType<typeof changed<T>> & EffectType;
export type NoopEffect = ReturnType<typeof noop> & EffectType;
export type ContradictionEffect<Curr = unknown, Inc = unknown> = ReturnType<typeof contradiction<Curr, Inc>> & EffectType;
export type CreationEffect = ReturnType<typeof effects['creation']> & EffectType;
export type EffectType = {
    [K in keyof typeof effects]: K extends keyof typeof effects ? (typeof effects)[K] : never
}