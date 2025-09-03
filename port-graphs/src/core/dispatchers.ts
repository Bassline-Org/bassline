import _, { isEqual } from 'lodash';

const BASSLINE_REACTIVE = Symbol('$$BASSLINE_REACTIVE$$');

type MergeFn<T> = (old: T, incoming: T) => T;
export type Dispatcher = typeof defaultDispatcher;

const defaultDispatcher = {
    eq: (a: any, b: any) => isEqual(a, b),
    onChange: (changed: Reactive, value: any) => {
        console.log('default changed!', value);
        changed.downstream.forEach(downstream => downstream.value = value);
    },
    read: (reactive: Reactive) => reactive.value,
    write: (reactive: Reactive, value: any) => reactive.value = value
} as const;


let currentDispatcher: Dispatcher = defaultDispatcher;

export const dispatcher = () => currentDispatcher;

export const usingDispatcher = (dispatcher: Dispatcher, fn: () => void) => {
    const oldDispatcher = currentDispatcher;
    currentDispatcher = dispatcher;
    try {
        fn();
    } finally {
        currentDispatcher = oldDispatcher;
    }
}

class Reactive<T = any> {
    downstream: Set<Reactive<T>>;
    value: T;
    [BASSLINE_REACTIVE] = true;
    constructor(initialValue: T) {
        this.downstream = new Set<Reactive<T>>();
        this.value = initialValue;
    }

    valueOf(): T {
        return this.value;
    }
}

// Helper functions using lodash
const isReactiveCell = (obj: any): obj is Reactive<any> => 
    _.isObject(obj) && (obj as any)[BASSLINE_REACTIVE] === true;

const unwrapReactiveArgs = (args: any[]) => 
    _.map(args, arg => isReactiveCell(arg) ? arg.value : arg);

function cell<T = any>(mergeFn: MergeFn<T>, initialValue: T = null as T, reactor: Reactive<T> = new Reactive(initialValue)) {
    return new Proxy(reactor, {
        // NOTE: This is basically like DNU in smalltalk
        // We are intercepting method calls on the value, and auto-unwrapping reactive cells in the arguments
        get(target, prop, receiver): any {
            // Check if the property exists on the value
            if (_.isObject(target.value) && prop in target.value) {
                const valueProp = (target.value as any)[prop];

                return _.isFunction(valueProp)
                ? (...args: any[]) => valueProp.apply(target.value, unwrapReactiveArgs(args))
                : valueProp
            }
            
            return Reflect.get(target, prop, receiver);
        },
        
        set(target, prop, value, receiver): boolean {
            if(prop !== 'value') return Reflect.set(target, prop, value, receiver);

            if(dispatcher().eq(target.value, value)) {
                console.log('Proxy ignoring change');
                return true
            }
            const merged = mergeFn(target.value, value);
            if(dispatcher().eq(target.value, merged)) {
                console.log('Proxy ignoring change after merge');
                return true;
            }
            target.value = merged;
            dispatcher().onChange(target, merged);
            return true;
        }
    });
}