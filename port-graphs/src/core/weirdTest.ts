import { isEqual } from 'lodash';

type Mode = 'wiring' | 'run';
type MergeFn = (current: any, ...rest: any[]) => any;

let current_mode: Mode = 'run';
let current_reactive: Reactive | null = null;

interface Reactive {
    (...args: any[]): any;
    value(): any;
    downstream: Set<Reactive>;
    isWired: boolean;
    isGadget: boolean;
    enterWiringMode(fn?: () => void): void;
    into(target: Reactive): Reactive;
}
function createReactive(body: (...args: any[]) => any, isGadget = false, stateful = false, initialValue?: any): Reactive {
    const downstream = new Set<Reactive>();
    let currentValue = initialValue;
    
    function call(...args: any[]): any {
        if (current_mode === 'wiring') {
            if (current_reactive) reactive.downstream.add(current_reactive);
            else throw new Error('No current reactive');
            return undefined;
        } else {
            const validArgs = args.filter(arg => arg !== undefined && arg !== null);
            
            if (stateful) {
                if (validArgs.length === 0) return currentValue;
                const result = body(currentValue, ...validArgs);
                if (!isEqual(result, currentValue)) {
                    currentValue = result;
                    reactive.downstream.forEach(downstream => downstream(result));
                }
                return result;
            } else {
                if (validArgs.length === 0) return body();
                const result = body(...validArgs);
                reactive.downstream.forEach(downstream => downstream(result));
                return result;
            }
        }
    }
    
    const reactive = Object.assign((...args: any[]) => call(...args), {
        call,
        value: stateful ? () => currentValue : body,
        downstream,
        isWired: false,
        isGadget,
        enterWiringMode(fn?: () => void) {
            if (reactive.isWired) return;
            const old_mode = current_mode;
            const old_reactive = current_reactive;
            current_mode = 'wiring';
            current_reactive = reactive;
            if (fn) fn();
            reactive.isWired = true;
            current_mode = old_mode;
            current_reactive = old_reactive;
        },
        into(target: Reactive) {
            if(reactive.downstream.has(target)) return target;
            reactive.downstream.add(target);
            target(reactive());
            return target;
        }
    });
    
    return reactive;
}

function Cell(mergeFn: MergeFn, initialValue: any = undefined): Reactive {
    return createReactive(mergeFn, false, true, initialValue);
}

function Gadget(body: (() => any) | ((...args: any[]) => any)): Reactive | ((...args: any[]) => Reactive) {
    if (body.length > 0) {
        return (...args: any[]) => Gadget(() => body(...args));
    } else {
        const gadget = createReactive(body, true);
        gadget.enterWiringMode(body);
        return gadget;
    }
}

const maxFn = (a: number, b: number) => {
    if (b === 0) return b;

    return Math.max(a, b);
};
const setUnion = (a: Set<any>, b: Set<any>) => new Set([...a, ...b]);

const a = Cell(maxFn, 0);
const b = Cell(maxFn, 0);
const c = Cell(maxFn, 0);

const adder = Gadget((a,b) => a() + b());
const subtractor = Gadget((a,b) => a() - b());

const abToC = adder(a, b);

const caToB = subtractor(c, a);

const cbToA = subtractor(c, b);

const foo = Gadget(() => abToC() + caToB() + cbToA());

abToC.into(c);
caToB.into(b);
cbToA.into(a);

a(5);
c(10);

console.log('a value:', a());
console.log('b value:', b());
console.log('c value:', c());
console.log('foo value:', foo());

const aSet = Cell(setUnion, new Set([1]));
const bSet = Cell(setUnion, new Set([2]));
const cSet = Cell(setUnion, new Set([3]));

aSet.into(bSet);
bSet.into(cSet);
cSet.into(aSet);

aSet([5, 7, 9]);

console.log('aSet downstream size:', aSet.downstream.size);
console.log('bSet downstream size:', bSet.downstream.size);
console.log('cSet downstream size:', cSet.downstream.size);

console.log('aSet value:', aSet());
console.log('bSet value:', bSet());
console.log('cSet value:', cSet());

const multiplier = Gadget((x, y) => x() * y());
// (x,y) => Gadget(() => x() * y())
const result = Cell(maxFn, 0);

multiplier(a, b).into(result);

a(2);
b(3);

console.log('Multiplier result:', result());