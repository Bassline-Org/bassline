/**
 * Clojure style multimethod dispatch
 * We define a dispatch function and a map of methods
 * The dispatch function simply returns a key into the method map
 * And the dispatch functions and method implementations have the same input signature
 */

export type DispatchFn<T extends any[] & {length: T['length']}, K> = (...args: T) => K;

export type DispatchMap<K extends string | number | symbol, V, T extends any[] & {length: T['length']}> = 
    Record<K, (...args: T) => V>

export type MultiMethod<T extends any[] & {length: T['length']}, K extends string | number | symbol, V> = {
    dispatch: DispatchFn<T, K>,
    action: DispatchMap<K, V, T>,
    defMethod: (key: K, fn: (...args: T) => V) => void,
    defMethods: (methods: Record<K, (...args: T) => V>) => void,
    (...args: T): V
}

export function defMulti<
    T extends any[] & {length: T['length']},
    K extends string | number | symbol,
    V,
>(
    dispatch: DispatchFn<T, K>,
): MultiMethod<T, K, V> {
    const action = {} as DispatchMap<K, V, T>;

    const defMethod = (key: K, fn: (...args: T) => V) => {
        action[key] = fn;
    };
    const defMethods = (methods: Record<K, (...args: T) => V>) => {
        for (const [key, fn] of Object.entries(methods)) {
            action[key] = fn;
        }
    };

    function call(...args: T): V {
        const key = dispatch(...args);
        const fn = action[key] || action['default'];
        if (!fn) {
            throw new Error(`No method or default for key: ${key.toString()}`);
        }
        return fn(...args);
    };

    call.dispatch = dispatch;
    call.action = action;
    call.defMethod = defMethod;
    call.defMethods = defMethods;

    return call
}