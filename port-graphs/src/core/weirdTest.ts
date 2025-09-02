

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
function createReactive(body: (...args: any[]) => any, isGadget = false): Reactive {
    const downstream = new Set<Reactive>()
    
    function call(...args: any[]): any {
        if (current_mode === 'wiring') {
            if (current_reactive) reactive.downstream.add(current_reactive)
            else throw new Error('No current reactive')
            return undefined
        } else {
            return body(...args)
        }
    }
    
    const reactive = Object.assign((...args: any[]) => call(...args), {
        call,
        value: body, // value() just calls the body
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
        }
    })
    
    return reactive
}

// Cell is a special kind of gadget that closes over state
function Cell(mergeFn: MergeFn, initialValue: any = undefined): Reactive {
    let currentValue = initialValue

    const cell = createReactive(function(...args: any[]) {
        // Cell body: handle arguments and merge with current value
        const processedArgs = args.map(arg => {
            if (arg?.isWired !== undefined || arg?.isGadget) {
                // This is a reactive, wire it up and get its value
                cell.downstream.add(arg)
                arg.downstream.add(cell) // Bidirectional connection
                return arg.value()
            }
            return arg
        })
        
        const result = processedArgs.reduce((acc, arg) => mergeFn(acc, arg), currentValue)
        if (result !== currentValue) {
            currentValue = result
            cell.downstream.forEach(d => d())
        }
        return result
    })
    
    return cell
}

// Gadget is just a pure function
function Gadget(body: () => any): Reactive {
    const gadget = createReactive(body, true)
    gadget.enterWiringMode(body)
    return gadget
}

const maxFn = (a: number, b: number) => Math.max(a, b);
const setUnion = (a: Set<number>, b: Set<number>) => new Set([...a, ...b]);

const a = Cell(maxFn, 0);
const b = Cell(maxFn, 0);
const c = Cell(maxFn, 0);

// Create a gadget that will wire up inputs during initialization
// The body is immediately executed in wiring mode to set up connections
const adder = Gadget(() => {
    return a() + b(); // a() and b() calls will wire up connections during construction
});

// Now we can wire up the gadget to the cell by calling c with the gadget
c(adder) // This will wire adder as an input to c and use adder's value

console.log('Gadget is wired:', adder.isWired);
console.log('Gadget downstream connections:', adder.downstream.size);

// Now subsequent calls will actually compute values
a(5);  // Set a to 5
b(3);  // Set b to 3

// The adder should now compute 5 + 3 = 8
console.log('Adder value:', adder.value());

a(123);
console.log('Adder value:', adder.value());

a(123);
console.log('Adder value:', adder.value());
console.log('Adder value:', adder.value());

const aSet = Cell(setUnion, new Set([1]));
const bSet = Cell(setUnion, new Set([2]));
const cSet = Cell(setUnion, new Set([3]));

aSet(bSet, cSet);
bSet(aSet, cSet);
cSet(aSet, bSet);


console.log('aSet value:', aSet());
console.log('bSet value:', bSet());
console.log('cSet value:', cSet());