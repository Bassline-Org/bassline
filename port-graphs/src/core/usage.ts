import {
    defGadget,
    customGadget,
    run,
    memory,
    merge,
    ignore,
    emit,
    cellStep,
    maxStep,
    counterStep,
    productStep,
    unionStep,
    appendStep,
    mapInput,
    mapOutput,
    filterInput
} from "./transduce";

// ============================================
// Example 1: Basic Gadgets with Type Inference
// ============================================

// Cell - only updates when value changes
const cell = defGadget(cellStep<string>, "hello");
const runCell = run(cell);

runCell("hello");  // No change
runCell("world");  // Updates to "world"
runCell("world");  // No change
console.log("Cell state:", (cell as any).source()); // "world"

// Max tracker
const max = defGadget(maxStep, 0);
const runMax = run(max);

runMax(5);   // Updates to 5
runMax(3);   // Stays at 5
runMax(10);  // Updates to 10
console.log("Max:", (max as any).source()); // 10

// Counter
const counter = defGadget(counterStep, 0);
const runCounter = run(counter);

runCounter(5);   // 5
runCounter(3);   // 8
runCounter(10);  // 18
console.log("Counter:", (counter as any).source()); // 18

// ============================================
// Example 2: Step Function Transformations
// ============================================

// Double inputs before counting
const doubledCounter = defGadget(
    mapInput((x: number) => x * 2, counterStep),
    0
);
const runDoubled = run(doubledCounter);

runDoubled(5);   // Actually adds 10
runDoubled(3);   // Actually adds 6
console.log("Doubled counter:", (doubledCounter as any).source()); // 16

// Filter only positive numbers
const positiveMax = defGadget(
    filterInput((x: number) => x > 0, maxStep),
    -Infinity
);
const runPositive = run(positiveMax);

runPositive(5);    // Updates to 5
runPositive(-10);  // Ignored
runPositive(3);    // Stays at 5
runPositive(8);    // Updates to 8
console.log("Positive max:", (positiveMax as any).source()); // 8

// Transform output effects
const loudCounter = defGadget(
    mapOutput(
        (effect) => {
            console.log("LOUD EFFECT:", effect);
            return effect;
        },
        counterStep
    ),
    0
);
run(loudCounter)(5); // Logs: LOUD EFFECT: { merge: 5 }

// ============================================
// Example 3: Custom Gadgets with Different Hosts
// ============================================

// External state source
let externalState = 100;
const externalGadget = customGadget(
    counterStep,
    () => externalState,  // Read from external
    (output) => {          // Write to external
        if ('merge' in output) {
            externalState = output.merge;
        }
    }
);

run(externalGadget)(50);
console.log("External state:", externalState); // 150

// Logging gadget
const loggingMax = customGadget(
    maxStep,
    () => 0,
    (output) => {
        if ('merge' in output) {
            console.log(`New maximum: ${output.merge}`);
        } else if ('ignore' in output) {
            console.log("Value ignored (not a new max)");
        }
    }
);

const runLogging = run(loggingMax);
runLogging(5);   // Logs: New maximum: 5
runLogging(3);   // Logs: Value ignored (not a new max)
runLogging(10);  // Logs: New maximum: 10

// ============================================
// Example 4: Collection Operations
// ============================================

// Set operations
const set = defGadget(unionStep<string>, new Set<string>());
const runSet = run(set);

runSet(["apple", "banana"]);
runSet(["banana", "cherry"]);  // Only adds cherry
runSet(["apple"]);             // No change
console.log("Set:", Array.from((set as any).source())); // ["apple", "banana", "cherry"]

// List append
const list = defGadget(appendStep<number>, []);
const runList = run(list);

runList(1);
runList(2);
runList(3);
console.log("List:", (list as any).source()); // [1, 2, 3]

// ============================================
// Example 5: Complex Step Functions
// ============================================

// Step that validates input and emits different effects
const validatingStep = (curr: number[], val: number) => {
    if (val < 0) {
        return emit('error', `Negative value: ${val}`);
    }
    if (val === 0) {
        return ignore();
    }
    if (val > 100) {
        return emit('warning', `Large value: ${val}`);
    }
    return merge([...curr, val]);
};

const validator = customGadget(
    validatingStep,
    () => [] as number[],
    (output) => {
        if ('merge' in output) {
            console.log("Valid values:", output.merge);
        } else if ('emit' in output) {
            const { event, data } = output.emit;
            console.log(`Event [${event}]:`, data);
        }
    }
);

const runValidator = run(validator);
runValidator(5);    // Valid values: [5]
runValidator(0);    // Ignored
runValidator(-3);   // Event [error]: Negative value: -3
runValidator(150);  // Event [warning]: Large value: 150
runValidator(10);   // Valid values: [5, 10]

// ============================================
// Example 6: Composing Step Functions
// ============================================

// Parse string to number, then run counter
const parseAndCount = defGadget(
    mapInput((s: string) => parseInt(s) || 0, counterStep),
    0
);
const runParser = run(parseAndCount);

runParser("5");    // Adds 5
runParser("3");    // Adds 3
runParser("abc");  // Adds 0 (parse fails)
runParser("10");   // Adds 10
console.log("Parsed count:", (parseAndCount as any).source()); // 18

// Chain multiple transformations
const complexStep = mapInput(
    (s: string) => s.length,           // String to length
    filterInput(
        (n: number) => n > 3,          // Only process if length > 3
        mapOutput(
            (e) => ({ ...e, timestamp: Date.now() }), // Add timestamp
            counterStep
        )
    )
);

const complex = defGadget(complexStep, 0);
const runComplex = run(complex);

runComplex("hi");       // Length 2, ignored
runComplex("hello");    // Length 5, adds 5
runComplex("world!");   // Length 6, adds 6
console.log("Complex result:", (complex as any).source()); // 11

// ============================================
// Example 7: Product Accumulator
// ============================================

const product = defGadget(productStep, 1);
const runProduct = run(product);

runProduct(2);  // 2
runProduct(3);  // 6
runProduct(4);  // 24
console.log("Product:", (product as any).source()); // 24

// ============================================
// Example 8: Memory Helper Pattern
// ============================================

const mem = memory({ count: 0, items: [] as string[] });

const statefulGadget = customGadget(
    (curr: typeof mem.get, val: string) => {
        const state = mem.get();
        return merge({
            count: state.count + 1,
            items: [...state.items, val]
        });
    },
    mem.get,
    (output) => {
        if ('merge' in output) {
            mem.set(output.merge);
        }
    }
);

run(statefulGadget)("first");
run(statefulGadget)("second");
console.log("Stateful:", mem.get()); // { count: 2, items: ["first", "second"] }