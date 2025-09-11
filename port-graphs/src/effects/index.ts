import { Gadget } from "../core";

export const noop = () => ['noop'] as const;
export const changed = <T>(value: NonNullable<T>) => ['changed', value] as const;
export const contradiction = <Curr, Inc>(current: NonNullable<Curr>, incoming: NonNullable<Inc>) =>
    ['contradiction', current, incoming] as const;

export const effects = {
    noop,
    changed,
    contradiction,
    creation: (gadget: Gadget) => ['creation', gadget] as const,
}

export type ChangedEffect<T> = ReturnType<typeof changed<T>> & EffectType;
export type NoopEffect = ReturnType<typeof noop> & EffectType;
export type ContradictionEffect<Curr, Inc> = ReturnType<typeof contradiction<Curr, Inc>> & EffectType;
export type CreationEffect = ReturnType<typeof effects['creation']> & EffectType;
export type EffectType<Key extends string = string, Value extends any[] = any[]> = [Key, ...Value];