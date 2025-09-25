import { State } from "./betterTypes";

// Contract constructors as a single map
type Contract = {
    type: ReturnType<typeof contracts[keyof typeof contracts]>['type'];
}

export const contracts = {
    record: <T extends Record<string, Contract>>(fields: T) => ({
        type: 'record',
        fields
    } as const),

    array: <T extends Contract>(of: T) => ({
        type: 'array',
        of,
    } as const),

    intersect: <T extends readonly Contract[]>(contracts: T) => ({
        type: 'intersect',
        contracts,
    } as const),

    union: <T extends readonly Contract[]>(options: T) => ({
        type: 'union',
        options,
    } as const),

    number: () => ({
        type: 'number',
    } as const),

    string: () => ({
        type: 'string',
    } as const),

    boolean: () => ({
        type: 'boolean',
    } as const),
};

const { record, array, union, number, string, boolean, intersect } = contracts;

export const defContract = <T>(contract: InferContract<T> extends never ? never : T) => {
    type Contract = InferContract<T>;
    return contract
};
// Helper type to convert union to intersection
type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

// Helper to infer all contracts in a tuple and intersect them
type InferSpread<T extends readonly any[]> = UnionToIntersection<
    T[number] extends infer U ? InferContract<U> : never
>;

export type InferContract<C> =
    C extends { type: 'intersect', contracts: infer T extends readonly any[] }
    ? InferSpread<T> :
    C extends { type: 'number' } ? number :
    C extends { type: 'string' } ? string :
    C extends { type: 'boolean' } ? boolean :
    C extends { type: 'literal', value: infer V } ? V :
    C extends { type: 'optional', of: infer T } ? InferContract<T> | undefined :
    C extends { type: 'array', of: infer T } ? Array<InferContract<T>> :
    C extends { type: 'record', fields: infer F } ? {
        [K in keyof F]: InferContract<F[K]>
    } :
    C extends { type: 'union', options: readonly [...infer O] } ? InferContract<O[number]> :
    C extends { type: 'ref', to: infer R }
    ? InferContract<R>
    : never;

const foo = defContract(record({
    state: number(),
}));
type Foo = InferContract<typeof foo>;

const bar = defContract(record({
    anotherField: number(),
}));

const combined = defContract(intersect([
    foo,
    bar,
]));

type Combined = InferContract<typeof combined>;