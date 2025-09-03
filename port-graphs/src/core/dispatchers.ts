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
    downstream: Set<Gadget>;
    boundInputs: Gadget[];
    body: (...args: any[]) => any;
    [BASSLINE_REACTIVE]: boolean;
}

export function Gadget(body: (...args: any[]) => any): Gadget {
    const downstream = new Set<Gadget>();
    const boundInputs: Gadget[] = [];
    
    function gadget(...args: any[]): any {
        const d = dispatcher();

        if (boundInputs.length === body.length) {
            return body(...boundInputs);
        }

        for (const arg of args) {
            if (arg?.[BASSLINE_REACTIVE]
                && !boundInputs.includes(arg)
                && boundInputs.length < body.length
            ) {
                boundInputs.push(arg);
                arg.downstream.add(gadget);
            }
        }
        
        if (args.length === 0) {
            return d.read(gadget as Gadget);
        }

        return gadget;
    }
    
    gadget.downstream = downstream;
    gadget.body = body;
    gadget.boundInputs = boundInputs;
    gadget[BASSLINE_REACTIVE] = true;
    
    return gadget;
}

type Cell = ReturnType<typeof Cell>;
export function Cell<T>(merge: MergeFn<T>, initial: T) {
    let state = initial;
    
    const cell = Gadget((values: T[]) => {
        const d = dispatcher();

        const value = values
            .filter(value => value !== undefined && value !== null)
            .reduce((acc, value) => merge(acc, value), state);
        
        if (!d.equivalent(state, value)) {
            const merged = merge(state, value);
            if (!d.equivalent(state, merged)) {
                state = merged;
                d.propagate(cell, state);
            }
        }
        return cell;
    });
    
    return cell;
}


// Usage is now dead simple:
const a = Cell(Math.max, 0);
const b = Cell(Math.max, 0);

console.log(a(), b());

a(123);
b(456);

console.log(a(), b());

// // Gadgets are just functions that read from their args
// const add = Gadget((x, y) => x() + y());

// // Wire by passing gadgets
// const c = Cell(Math.max, 0);
// c(add);  // c now gets values from add

// // A gadget takes a body function, and returns a curried function that allows us to bind inputs to cells and other gadgets.
// const adder = Gadget((a,b) => a() + b());
// const foo = Gadget(() => 5);
// const bar = Gadget(() => 10);
// console.log('foo: ', foo());
// console.log('bar: ', bar());

// const myAdder = adder(foo, bar);
// console.log(myAdder());

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