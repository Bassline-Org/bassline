import { isEqual } from 'lodash';

const BASSLINE_REACTIVE = Symbol('$$BASSLINE_REACTIVE$$');

export interface Dispatcher {
    eq: (a: any, b: any) => boolean;
    propagate: (source: Reactive, value: any) => void;
    read: (reactive: Reactive) => any;
    write: (reactive: Reactive, value: any) => void;
}

class Reactive<T = any> {
    downstream = new Set<Reactive>();
    value: T;
    compute: (current: T, ...args: any[]) => T;
    [BASSLINE_REACTIVE] = true;
    
    constructor(compute: (current: T, ...args: any[]) => T, initial: T) {
        this.compute = compute;
        this.value = initial;
    }
}

const runDispatcher: Dispatcher = {
    eq: isEqual,
    propagate: (source, value) => {
        source.downstream.forEach(target => {
            // Compute always gets current state as first arg
            const newValue = target.compute(target.value, value);
            if (dispatcher().eq(target.value, newValue)) {
                return;
            }
            
            target.value = newValue;

            dispatcher().propagate(target, target.value);
        });
    },
    read: (reactive) => reactive.value,
    write: (reactive, value) => {
        const newValue = reactive.compute(reactive.value, value);
        if (!isEqual(reactive.value, newValue)) {
            reactive.value = newValue;
            dispatcher().propagate(reactive, newValue);
        }
    }
};

let currentDispatcher: Dispatcher = runDispatcher;
export function dispatcher() { return currentDispatcher };
export function derive(fn: (old: Dispatcher) => Dispatcher) {
    return fn(currentDispatcher)
}
export function usingDispatcher(dispatcher: Dispatcher, fn: () => any) {
    const previousDispatcher = currentDispatcher;
    currentDispatcher = dispatcher;
    fn();
    currentDispatcher = previousDispatcher;
}
export function wireDispatcher(target: CallableReactive, fn: () => any = () => target()) {
    const disp = derive(old => ({
        eq: old.eq,
        propagate: old.propagate,
        read: (reactive: Reactive) => {
            if (reactive === target) {
                return old.read(reactive);
            }
            console.log('adding', reactive, 'to');
            reactive.downstream.add(target);
            return old.read(reactive);
        },
        write: (reactive: Reactive, value: any) => {
            console.log('writing');
            target.downstream.add(reactive);
            old.write(reactive, value);
        }
    }));
    usingDispatcher(disp, () => fn());
    return target;
}

export function Cell<T>(merge: (old: T, incoming: T) => T, initial: T): any {
    const reactive = new Reactive(merge, initial);
    
    function cell(...args: any[]) {
        if (args.length === 0) {
            return dispatcher().read(reactive);
        }
        args.forEach(arg => {
            if(arg?.[BASSLINE_REACTIVE]) {
                arg.downstream.add(reactive);
            } else {
                dispatcher().write(reactive, arg);
            }
        });
        return cell;
    }
    Object.assign(cell, reactive);
    return cell;
}

// Gadget ignores current state, just computes
export type Gadget = ReturnType<typeof Gadget> & CallableReactive;

export type CallableReactive = Reactive & ((...args: any[]) => any);

export function Gadget(fn: (...args: CallableReactive[]) => any, bindings: CallableReactive[]) {
    if (fn.length != bindings.length) {
        throw new Error('Gadget function must have the same number of arguments as bindings');
    }

    const reactive = new Reactive(() => fn(...bindings.map(b => b())), undefined);
    
    function gadget() {
        return dispatcher().read(reactive);
    }
    
    Object.assign(gadget, reactive);
    
    wireDispatcher(gadget as CallableReactive);
    gadget();
    
    return gadget;
}

const maxFn = Math.max;

const a = Cell(maxFn, 0);
const b = Cell(maxFn, 0);
const c = Cell(maxFn, 0);

//console.log(a(), b(), c());
a(10);
b(20);
c(30);

const adder = Gadget((a, b) => a() + b(), [a, b]);
console.log(adder());
//wireDispatcher(adder);
//console.log(adder);
//console.log(a, b, c);

a(b,c);

c(100);

console.log(a(), b(), c());