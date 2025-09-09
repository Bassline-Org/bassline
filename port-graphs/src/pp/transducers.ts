
// Core Types
type Reducer<State, Input> = (state: State, input: Input) => State;

export function map<Input, Output>(fn: (arg: Input) => Output): Reducer<Output, Input> {
    return (current: Output, incoming: Input) => fn(incoming)
}

export function filter<Input>(fn: (arg: Input) => boolean): Reducer<Input, Input> {
    return (current: Input, incoming: Input) => fn(incoming) ? incoming : current
}

export function transduce<Output, Input>(xform: Reducer<Output, Input>, f: (acc: Output, curr: Output) => Output, col: Input[], init: Output): Output {
    // Apply the transducer to the reducing function to create a new reducer
    // The transducer transforms f to work with Input instead of Output
    return col.reduce((acc, curr) => {
        // Apply the transducer to get the transformed value
        const transformed = xform(acc, curr);
        // Then apply the final reducing function
        return f(acc, transformed);
    }, init)
}

export function compose<T extends readonly Reducer<any, any>[]>(
  ...fns: T
): Reducer<
  T extends readonly [...any[], infer Last] 
    ? Last extends Reducer<infer Output, any> ? Output : never
    : never,
  T extends readonly [infer First, ...any[]]
    ? First extends Reducer<any, infer Input> ? Input : never
    : never
> {
  return (current: any, incoming: any) => 
    fns.reduce((acc, fn) => fn(acc, incoming), current)
}