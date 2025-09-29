import {
    // Core
    gadget,
    run,
    memory,

    // Effects
    merge,
    ignore,
    emit,

    // Step functions
    cellStep,
    maxStep,
    minStep,
    counterStep,
    alwaysMerge,

    // Morphism combinators
    contramapFirst,
    contramapSecond,
    mapOutput,
    dimap,
    pipe,

    // Effect combinators
    extractMerge,
    whenMerged,
    filterMerged,
    filterEffect,

    // Composition
    parallel,
    sequence,
    choose,

    // Lens combinators
    lens,
    prop,

    // Examples
    maxAbove,
    doubledMax,
    constrainedMax,
    maxGadget
} from "./transduce";

// ============================================
// Example 1: Basic Morphism Composition
// ============================================

console.log("=== Basic Morphisms ===");

// Transform input before step
const celsiusToFahrenheit = contramapSecond(
    (c: number) => (c * 9/5) + 32,
    maxStep
);

// Now maxStep works with Celsius input
const tempGadget = gadget(celsiusToFahrenheit, memory(0), (step, ctx) => ({
    source: ctx.get,
    step,
    sink: (e) => {
        if ('merge' in e) {
            ctx.set(e.merge);
            console.log(`New max temp (F): ${e.merge}`);
        }
    }
}));

run(tempGadget)(20);  // 68°F
run(tempGadget)(25);  // 77°F
run(tempGadget)(15);  // 59°F (ignored)

// ============================================
// Example 2: Effect Transformations
// ============================================

console.log("\n=== Effect Transformations ===");

// Double the merged value
const doubled = whenMerged(maxStep, (v: number) => v * 2);

const doubledGadget = gadget(doubled, memory(0), (step, ctx) => ({
    source: ctx.get,
    step,
    sink: (e) => {
        if ('merge' in e) {
            ctx.set(e.merge);
            console.log(`Doubled max: ${e.merge}`);
        }
    }
}));

run(doubledGadget)(5);   // 10
run(doubledGadget)(3);   // ignored
run(doubledGadget)(8);   // 16

// ============================================
// Example 3: Filtering Effects
// ============================================

console.log("\n=== Filtering Effects ===");

// Only merge values above 10
const filteredMax = filterMerged(
    (v: number) => v > 10,
    maxStep
);

const filteredGadget = gadget(filteredMax, memory(0), (step, ctx) => ({
    source: ctx.get,
    step,
    sink: (e) => {
        if ('merge' in e) {
            ctx.set(e.merge);
            console.log(`Filtered max: ${e.merge}`);
        } else {
            console.log("Value filtered out");
        }
    }
}));

run(filteredGadget)(5);   // filtered
run(filteredGadget)(15);  // 15
run(filteredGadget)(12);  // filtered (not > 15)
run(filteredGadget)(20);  // 20

// ============================================
// Example 4: Nested State with Lenses
// ============================================

console.log("\n=== Nested State ===");

type AppState = {
    user: {
        score: number;
        name: string;
    };
    settings: {
        theme: string;
    };
};

// Focus maxStep on user.score
const scoreStep = lens(
    (s: AppState) => s.user.score,
    (s, score) => ({ ...s, user: { ...s.user, score } }),
    maxStep
);

const appGadget = gadget(scoreStep, memory<AppState>({
    user: { score: 0, name: "Alice" },
    settings: { theme: "dark" }
}), (step, ctx) => ({
    source: ctx.get,
    step,
    sink: (e) => {
        if ('merge' in e) {
            // Note: we need to update the nested value properly
            const current = ctx.get();
            ctx.set({ ...current, user: { ...current.user, score: e.merge } });
            console.log(`New high score: ${e.merge}`);
        }
    }
}));

run(appGadget)(100);
run(appGadget)(50);   // ignored
run(appGadget)(150);

// ============================================
// Example 5: Parallel Composition
// ============================================

console.log("\n=== Parallel Composition ===");

// Run max and min in parallel
const maxAndMin = parallel(maxStep, minStep);

const parallelGadget = gadget(maxAndMin, memory({ max: -Infinity, min: Infinity }), (step, ctx) => ({
    source: () => ctx.get().max,  // Use max as "current state"
    step,
    sink: ([maxEffect, minEffect]) => {
        const state = ctx.get();
        if ('merge' in maxEffect) {
            state.max = maxEffect.merge;
            console.log(`New max: ${maxEffect.merge}`);
        }
        if ('merge' in minEffect) {
            state.min = minEffect.merge;
            console.log(`New min: ${minEffect.merge}`);
        }
        ctx.set(state);
    }
}));

run(parallelGadget)(5);   // max: 5, min: 5
run(parallelGadget)(10);  // max: 10
run(parallelGadget)(3);   // min: 3
run(parallelGadget)(7);   // nothing

// ============================================
// Example 6: Sequential with Bridge
// ============================================

console.log("\n=== Sequential Composition ===");

// First step: check if value > current
// Bridge: extract merge value or use 0
// Second step: add to counter
const sequenced = sequence(
    maxStep,
    (effect) => extractMerge(effect) || 0,
    counterStep
);

const seqGadget = gadget(sequenced, memory(0), (step, ctx) => ({
    source: ctx.get,
    step,
    sink: (e) => {
        if ('merge' in e) {
            ctx.set(e.merge);
            console.log(`Sequential result: ${e.merge}`);
        }
    }
}));

run(seqGadget)(5);   // 5 (max updates, adds 5)
run(seqGadget)(3);   // 5 (max doesn't update, adds 0)
run(seqGadget)(10);  // 15 (max updates to 10, adds 10)

// ============================================
// Example 7: Complex Transformations
// ============================================

console.log("\n=== Complex Transformations ===");

// Compose multiple transformations
const complex = pipe(
    filterMerged((v: number) => v % 2 === 0, maxStep),  // Only even numbers
    (effect) => {
        const val = extractMerge(effect);
        if (val && val > 50) {
            return emit('high_value', val);
        }
        return effect;
    }
);

const complexGadget = gadget(complex, memory(0), (step, ctx) => ({
    source: ctx.get,
    step,
    sink: (e) => {
        if ('merge' in e) {
            ctx.set(e.merge);
            console.log(`Even max: ${e.merge}`);
        } else if ('emit' in e) {
            console.log(`Event: ${e.emit.event} - ${e.emit.data}`);
        } else if ('ignore' in e) {
            console.log("Ignored (odd or not max)");
        }
    }
}));

run(complexGadget)(5);   // ignored (odd)
run(complexGadget)(10);  // 10
run(complexGadget)(7);   // ignored (odd)
run(complexGadget)(8);   // ignored (not > 10)
run(complexGadget)(60);  // Event: high_value
run(complexGadget)(12);  // ignored (not > 60)

// ============================================
// Example 8: Choose Based on Condition
// ============================================

console.log("\n=== Conditional Choice ===");

// Choose different steps based on a condition
const conditional = choose(
    (curr: number, val: number) => val >= 0,
    maxStep,     // For positive numbers
    minStep      // For negative numbers
);

const choiceGadget = gadget(conditional, memory(0), (step, ctx) => ({
    source: ctx.get,
    step,
    sink: (e) => {
        if ('merge' in e) {
            ctx.set(e.merge);
            console.log(`Choice result: ${e.merge}`);
        }
    }
}));

run(choiceGadget)(5);    // max: 5
run(choiceGadget)(-3);   // min: -3
run(choiceGadget)(10);   // max: 10
run(choiceGadget)(-5);   // min: -5
run(choiceGadget)(7);    // ignored (not > 10)

// ============================================
// Example 9: Full Dimap
// ============================================

console.log("\n=== Full Dimap ===");

// Transform all three parts
const scaled = dimap(
    (s: number) => s / 10,        // Scale down state
    (i: string) => parseInt(i),   // Parse string input
    (e) => {                       // Transform effect
        if ('merge' in e) {
            return merge(e.merge * 10);  // Scale back up
        }
        return e;
    },
    maxStep
);

const dimapGadget = gadget(scaled, memory(100), (step, ctx) => ({
    source: ctx.get,
    step,
    sink: (e) => {
        if ('merge' in e) {
            ctx.set(e.merge);
            console.log(`Scaled result: ${e.merge}`);
        }
    }
}));

run(dimapGadget)("15");  // 150 (parse 15, compare with 10, scale up)
run(dimapGadget)("5");   // ignored (5 not > 10)
run(dimapGadget)("20");  // 200