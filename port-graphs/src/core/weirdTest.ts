

import { isEqual } from 'lodash';

type Mode = 'wiring' | 'run'
type MergeFn = (current: any, ...rest: any[]) => any

let current_mode: Mode = 'run'
let current_reactive: any = null

// Call signature for reactive objects
type Reactive = {
    (...args: any[]): any
    value(): any
    downstream: Set<Reactive>
    isWired: boolean
    isGadget: boolean
    enterWiringMode(fn?: () => void): void
}

// Create callable reactive object
function createReactive(body: (...args: any[]) => any, isGadget = false, stateful = false, initialValue?: any): Reactive {
    const downstream = new Set<Reactive>()
    let currentValue = initialValue
    
    function call(...args: any[]): any {
        if (current_mode === 'wiring') {
            if (current_reactive) reactive.downstream.add(current_reactive)
            else throw new Error('No current reactive')
            return undefined
        } else {
            // Filter out undefined/null values
            const validArgs = args.filter(arg => arg !== undefined && arg !== null)
            
            if (stateful) {
                // For stateful reactives, only call body if we have valid arguments
                if (validArgs.length === 0) {
                    return currentValue
                }
                const result = body(currentValue, ...validArgs)
                
                // Use lodash isEqual for structural comparison
                if (!isEqual(result, currentValue)) {
                    currentValue = result
                    // Notify downstream reactives
                    reactive.downstream.forEach(downstream => downstream(result))
                }
                return result
            } else {
                const result = body(...validArgs)
                // Notify downstream reactives with the result
                reactive.downstream.forEach(downstream => downstream(result))
                return result
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
            if (reactive.isWired) return
            const old_mode = current_mode
            const old_reactive = current_reactive
            current_mode = 'wiring'
            current_reactive = reactive
            if (fn) fn()
            reactive.isWired = true
            current_mode = old_mode
            current_reactive = old_reactive
        },
        connectAsInput() {
            if (!current_reactive) throw new Error('No current reactive')
            current_reactive.downstream.add(reactive)
        },
        into(target: Reactive) {
            if(reactive.downstream.has(target)) return target;
            reactive.downstream.add(target)
            target(reactive.value())
            return target
        }
    })
    
    return reactive
}

// Cell is a special kind of gadget that closes over state
function Cell(mergeFn: MergeFn, initialValue: any = undefined): Reactive {
    return createReactive(mergeFn, false, true, initialValue)
}

// Gadget is just a pure function
function Gadget(body: (() => any) | ((...args: any[]) => any)): Reactive | ((...args: any[]) => Reactive) {
    // Check if body is a function with parameters (length > 0)
    if (body.length > 0) {
        // Return a function that takes arguments and returns a gadget
        return (...args: any[]) => Gadget(() => body(...args))
    } else {
        // Body is a function with no parameters
        const gadget = createReactive(body, true)
        gadget.enterWiringMode(body)
        return gadget
    }
}

const maxFn = (a: number, b: number) => Math.max(a, b);
const setUnion = (a: Set<any>, b: Set<any>) => new Set([...a, ...b]);

const a = Cell(maxFn, 0);
const b = Cell(maxFn, 0);
const c = Cell(maxFn, 0);

// Create a gadget that will wire up inputs during initialization
// The body is immediately executed in wiring mode to set up connections
const adder = Gadget(() => {
    return a() + b(); // a() and b() calls will wire up connections during construction
});

// Now we can wire up the gadget to the cell using the explicit .into() method
adder.into(c) // This explicitly wires adder as an input to c

console.log('Gadget is wired:', adder.isWired);
console.log('Gadget downstream connections:', adder.downstream.size);

// Now subsequent calls will actually compute values
a(5);  // Set a to 5
b(3);  // Set b to 3

// The adder should now compute 5 + 3 = 8
console.log('Adder value:', adder.value());
console.log('a value:', a());
console.log('b value:', b());

a(123);
console.log('Adder value:', adder.value());

a(123);
console.log('Adder value:', adder.value());
console.log('Adder value:', adder.value());

const aSet = Cell(setUnion, new Set([1]));
const bSet = Cell(setUnion, new Set([2]));
const cSet = Cell(setUnion, new Set([3]));

aSet.into(bSet);
bSet.into(cSet);
cSet.into(aSet);

aSet([5,7,9]);


console.log('aSet downstream size:', aSet.downstream.size);
console.log('bSet downstream size:', bSet.downstream.size);
console.log('cSet downstream size:', cSet.downstream.size);

console.log('aSet value:', aSet());
console.log('bSet value:', bSet());
console.log('cSet value:', cSet());

// Test parameterized gadget
const multiplier = Gadget((x, y) => x() * y());
const result = Cell(maxFn, 0);
multiplier(a, b).into(result); // Call multiplier with a and b as arguments and wire to result

a(2);
b(3);
console.log('Multiplier result:', result());