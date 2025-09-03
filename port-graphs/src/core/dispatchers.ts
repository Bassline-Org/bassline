import _, { isEqual } from 'lodash';

const BASSLINE_REACTIVE = Symbol('$$BASSLINE_REACTIVE$$');

type MergeFn<T> = (old: T, incoming: T) => T;

export interface Dispatcher {
    // Core reactive operations
    eq: (a: any, b: any) => boolean;
    onChange: (changed: Reactive, value: any) => void;

    // Read/Write operations
    read: (reactive: Reactive) => any;
    write: (reactive: Reactive, value: any) => void;

    // Method call interception
    beforeMethodCall?: (reactive: Reactive, methodName: string, args: any[]) => void;
    afterMethodCall?: (reactive: Reactive, methodName: string, args: any[], result: any) => void;

    // Property access interception
    beforePropertyRead?: (reactive: Reactive, property: string | symbol) => void;
    beforePropertyWrite?: (reactive: Reactive, property: string | symbol, value: any) => void;
}

const defaultDispatcher: Dispatcher = {
    eq: (a: any, b: any) => isEqual(a, b),
    onChange: (changed: Reactive, value: any) => {
        console.log('default changed!', value);
        changed.downstream.forEach(downstream => downstream.value = value);
    },
    read: (reactive: Reactive) => reactive.value,
    write: (reactive: Reactive, value: any) => reactive.value = value
};

function deriveDispatcher(object: Partial<Dispatcher>, defaults: Dispatcher = defaultDispatcher) {
    return {
        ...defaults,
        ...object
    }
}

// Example: Wiring dispatcher - captures connections instead of executing
export const wiringDispatcher: Dispatcher = deriveDispatcher({
    write: (reactive: Reactive, value: any) => {
        console.log('WIRING: Would write', value, 'to', reactive);
    }
})

// Example: Debug dispatcher - logs everything
export const debugDispatcher: Dispatcher = deriveDispatcher({
    eq: (a: any, b: any) => isEqual(a, b),
    onChange: (changed: Reactive, value: any) => {
        console.log('🔔 DEBUG: Value changed!', { changed, value });
        changed.downstream.forEach(downstream => downstream.value = value);
    },
    read: (reactive: Reactive) => {
        console.log('📖 DEBUG: Reading from', reactive, '=', reactive.value);
        return reactive.value;
    },
    write: (reactive: Reactive, value: any) => {
        console.log('✏️ DEBUG: Writing', value, 'to', reactive);
        reactive.value = value;
    },
    beforeMethodCall: (reactive: Reactive, methodName: string, args: any[]) => {
        console.log(`🔧 DEBUG: Method call ${methodName} on`, reactive, 'with args', args);
    },
    afterMethodCall: (_reactive: Reactive, methodName: string, _args: any[], result: any) => {
        console.log(`✅ DEBUG: Method ${methodName} completed, result:`, result);
    },
    beforePropertyRead: (reactive: Reactive, property: string | symbol) => {
        console.log(`👀 DEBUG: Reading property ${String(property)} from`, reactive);
    },
    beforePropertyWrite: (reactive: Reactive, property: string | symbol, value: any) => {
        console.log(`✍️ DEBUG: Writing property ${String(property)} =`, value, 'to', reactive);
    }
});


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

    addDownstream(downstream: Reactive<T>) {
        if (this.downstream.has(downstream)) return;
        this.downstream.add(downstream);
        downstream.value = this.value;
    }

    valueOf(): T {
        return this.value;
    }
}

// Helper functions using lodash
const isReactiveCell = (obj: any): obj is Reactive<any> => obj?.[BASSLINE_REACTIVE] === true;

const unwrapReactiveArgs = (args: any[]) =>
    _.map(args, arg => isReactiveCell(arg) ? arg.value : arg);

function cell<T = any>(mergeFn: MergeFn<T>, initialValue: T = null as T, reactor: Reactive<T> = new Reactive(initialValue)) {
    return new Proxy(reactor, {
        // NOTE: This is basically like DNU in smalltalk
        // We are intercepting method calls on the value, and auto-unwrapping reactive cells in the arguments
        get(target, prop, receiver): any {
            const d = dispatcher;
            d().beforePropertyRead?.(target, prop);
            const valueProp = target?.value?.[prop as keyof T] ?? undefined;
            if (!valueProp) return Reflect.get(target, prop, receiver);

            if(! _.isFunction(valueProp)) return valueProp;

            return (...args: any[]) => {
                d().beforeMethodCall?.(target, String(prop), args);
                const result = valueProp.apply(target.value, unwrapReactiveArgs(args));
                d().afterMethodCall?.(target, String(prop), args, result);
                return result;
            };
        },

        set(target, prop, value, receiver): boolean {
            if (prop !== 'value') return Reflect.set(target, prop, value, receiver);

            // Notify dispatcher about property write
            dispatcher().beforePropertyWrite?.(target, prop, value);

            if (dispatcher().eq(target.value, value)) {
                console.log('Proxy ignoring change');
                return true
            }

            const merged = mergeFn(target.value, value);

            if (dispatcher().eq(target.value, merged)) {
                console.log('Proxy ignoring change after merge');
                return true;
            }

            // Use dispatcher's write method
            dispatcher().write(target, merged);
            dispatcher().onChange(target, merged);
            return true;
        }
    });
}

//const adder = gadget((a,b) => a + b);

// Test the dispatcher system
console.log('=== Testing Dispatcher System ===');

function testCase() {
    const a = cell(Math.max);
    const b = cell(Math.max);
    const c = cell(Math.max);

    a.addDownstream(b);
    b.addDownstream(c);

    a.value = 1;
}

console.log('\n--- Default Dispatcher ---');
testCase();

console.log('\n--- Debug Dispatcher ---');
usingDispatcher(debugDispatcher, () => {
    testCase();
});

console.log('\n--- Wiring Dispatcher ---');
usingDispatcher(wiringDispatcher, () => {
    testCase();
});

const foo = cell(Math.max, 5);

console.log('foo: ', foo.value);
console.log('foo.call(): ', foo());