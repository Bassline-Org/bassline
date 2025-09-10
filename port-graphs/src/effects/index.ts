export const noop = () => ['noop'] as const;
export const changed = <T>(value: NonNullable<T>) => ['changed', value] as const;
export const contradiction = <Curr, Inc>(current: NonNullable<Curr>, incoming: NonNullable<Inc>) =>
    ['contradiction', current, incoming] as const;