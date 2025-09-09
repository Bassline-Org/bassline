/**
 * Clojure style multimethod dispatch
 * We define a dispatch function and a map of methods
 * The dispatch function simply returns a key into the method map
 * And the dispatch functions and method implementations have the same input signature
 */
export function defMulti<
    T extends any[] & {length: T['length']},
    V,
>(
    dispatch: DispatchFn<T, DispatchKey>,
): MultiMethod<T, DispatchKey, V> {
    const action = {} as DispatchMap<V, T>;

    const defMethod = (key: DispatchKey, fn: (...args: T) => V) => {
        action[key] = fn;
        return call;
    };
    const defMethods = (methods: Record<string | number | symbol | 'default', (...args: T) => V>) => {
        for (const [key, fn] of Object.entries(methods)) {
            action[key] = fn;
        }
        return call;
    };

    function call(...args: T): V {
        const key = dispatch(...args);
        const fn = action[key] || action['default' as string | number | symbol | 'default'];
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

// ================================
// Types
// ================================

export type DispatchFn<T extends any[] & {length: T['length']}, K>
    = (...args: T) => K;

export type DispatchKey = string | number | symbol | 'default';
export type DispatchMap<
    Return,
    T extends any[] & {length: T['length']}>
        = Record<string |number | symbol | 'default', (...args: T) => Return>

export type MultiMethod<
    T extends any[] & {length: T['length']},
    Key extends string | number | symbol, 
    Return> 
    = {
        dispatch: DispatchFn<T, Key>,
        action: DispatchMap<Return, T>,
        defMethod: (key: Key, fn: (...args: T) => Return) => MultiMethod<T, Key, Return>,
        defMethods: (methods: Record<Key, (...args: T) => Return>) => MultiMethod<T, Key, Return>,
        (...args: T): Return
    }