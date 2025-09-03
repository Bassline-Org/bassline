import _, { isEqual } from 'lodash';

const BASSLINE_REACTIVE = Symbol('$$BASSLINE_REACTIVE$$');

export type MergeFn<T> = (old: T, incoming: T) => T;

export interface Dispatcher {
    // Core reactive operations
    equivalent: (a: any, b: any) => boolean;
    propagate: (gadget: Gadget, value: any) => void;

    // Read/Write operations
    read: (gadget: Gadget) => any;
    write: (gadget: Gadget, value: any) => void;
}

const defaultDispatcher: Dispatcher = {
    equivalent: (a: any, b: any) => isEqual(a, b),
    propagate: (gadget: Gadget, value: any) => {
        console.log('default propagate!', value);
        gadget.downstream.forEach(downstream => downstream(value));
    },
    read: (gadget: Gadget) => gadget(),
    write: (gadget: Gadget, value: any) => gadget(value)
}

// A mutable variable that allows us to dynamically change the dispatcher
let currentDispatcher: Dispatcher = defaultDispatcher;
export const derive = (source: Dispatcher, derivation: Partial<Dispatcher>) => ({...source, ...derivation })
export const dispatcher = () => currentDispatcher;

// Allows us to temporarily change the dispatcher, useful for temporarily changing the semantics of evaluation
export const usingDispatcher = (dispatcher: Dispatcher, fn: () => void) => {
    const oldDispatcher = currentDispatcher;
    currentDispatcher = dispatcher;
    try {
        fn();
    } finally {
        currentDispatcher = oldDispatcher;
    }
}

export interface Gadget {
    (...args: any[]): any;
    bindInputs: (...args: Gadget[]) => void;
    downstream: Set<Gadget>;
    boundInputs: Gadget[];
    body: (...args: any[]) => any;
    [BASSLINE_REACTIVE]: true;
}

export function Gadget(body: (...args: any[]) => any): Gadget {
    const downstream = new Set<Gadget>();
    const boundInputs: Gadget[] = [];
    let gadget: Gadget;
    
    function call(...args: any[]): any {
        if (boundInputs.length < body.length) {
            const gadgets = args.filter(arg => arg?.[BASSLINE_REACTIVE]);
            bindInputs(...gadgets);
            if(boundInputs.length === body.length) return gadget;
        }
        return body(...boundInputs);
    }
    
    function bindInputs(...args: Gadget[]): void {
        for (const arg of args) {
            if (boundInputs.length === body.length) return;
            if (boundInputs.includes(arg)) continue;
            boundInputs.push(arg);
            arg.downstream.add(gadget);
        }
    }

    // Create the callable gadget object
    gadget = Object.assign(call, {
        downstream,
        boundInputs,
        body,
        bindInputs,
        [BASSLINE_REACTIVE]: true as const
    });
    
    return gadget;
}

// A gadget takes a body function, and returns a curried function that allows us to bind inputs to cells and other gadgets.
const adder = Gadget((a,b) => a() + b());
const foo = Gadget(() => 5);
const bar = Gadget(() => 10);
console.log('foo: ', foo());
console.log('bar: ', bar());

const myAdder = adder(foo, bar);
console.log(myAdder());

// class Reactive<T = any> {
//     downstream: Set<Reactive<T>>;
//     value: T;
//     [BASSLINE_REACTIVE] = true;
//     constructor(initialValue: T) {
//         this.downstream = new Set<Reactive<T>>();
//         this.value = initialValue;
//     }

//     addDownstream(downstream: Reactive<T>) {
//         if (this.downstream.has(downstream)) return;
//         this.downstream.add(downstream);
//         downstream.value = this.value;
//     }

//     valueOf(): T {
//         return this.value;
//     }
// }

// // Helper functions using lodash
// const isReactiveCell = (obj: any): obj is Reactive<any> => obj?.[BASSLINE_REACTIVE] === true;

// const unwrapReactiveArgs = (args: any[]) =>
//     _.map(args, arg => isReactiveCell(arg) ? arg.value : arg);

// function cell<T = any>(mergeFn: MergeFn<T>, initialValue: T = null as T, reactor: Reactive<T> = new Reactive(initialValue)) {
//     return new Proxy(reactor, {
//         // NOTE: This is basically like DNU in smalltalk
//         // We are intercepting method calls on the value, and auto-unwrapping reactive cells in the arguments
//         get(target, prop, receiver): any {
//             const d = dispatcher;
//             d().beforePropertyRead?.(target, prop);
//             const valueProp = target?.value?.[prop as keyof T] ?? undefined;
//             if (!valueProp) return Reflect.get(target, prop, receiver);

//             if(! _.isFunction(valueProp)) return valueProp;

//             return (...args: any[]) => {
//                 d().beforeMethodCall?.(target, String(prop), args);
//                 const result = valueProp.apply(target.value, unwrapReactiveArgs(args));
//                 d().afterMethodCall?.(target, String(prop), args, result);
//                 return result;
//             };
//         },

//         set(target, prop, value, receiver): boolean {
//             if (prop !== 'value') return Reflect.set(target, prop, value, receiver);

//             // Notify dispatcher about property write
//             dispatcher().beforePropertyWrite?.(target, prop, value);

//             if (dispatcher().eq(target.value, value)) {
//                 console.log('Proxy ignoring change');
//                 return true
//             }

//             const merged = mergeFn(target.value, value);

//             if (dispatcher().eq(target.value, merged)) {
//                 console.log('Proxy ignoring change after merge');
//                 return true;
//             }

//             // Use dispatcher's write method
//             dispatcher().write(target, merged);
//             dispatcher().onChange(target, merged);
//             return true;
//         }
//     });
// }

// //const adder = gadget((a,b) => a + b);

// // Test the dispatcher system
// console.log('=== Testing Dispatcher System ===');

// function testCase() {
//     const a = cell(Math.max);
//     const b = cell(Math.max);
//     const c = cell(Math.max);

//     a.addDownstream(b);
//     b.addDownstream(c);

//     a.value = 1;
// }

// console.log('\n--- Default Dispatcher ---');
// testCase();

// console.log('\n--- Debug Dispatcher ---');
// usingDispatcher(debugDispatcher, () => {
//     testCase();
// });

// console.log('\n--- Wiring Dispatcher ---');
// usingDispatcher(wiringDispatcher, () => {
//     testCase();
// });

// const foo = cell(Math.max, 5);

// console.log('foo: ', foo.value);
// console.log('foo.call(): ', foo());