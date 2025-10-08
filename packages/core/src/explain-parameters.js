/**
 * PARAMETER SYSTEM EXPLAINED
 *
 * Parameters let you create reusable compound gadgets with configurable values.
 * Here's how they work step-by-step:
 */

import { bl, installPackage } from "./index.js";
import { loadPackage } from "./packageLoader.js";
import { createPackageResolver } from "./packageResolver.js";
bl();

import cells from "./patterns/cells/index.js";
import systems from "./patterns/systems/index.js";
installPackage(cells);
installPackage(systems);

console.log("=== HOW PARAMETERS WORK ===\n");

// ============================================================
// STEP 1: Package Definition with Parameters
// ============================================================
console.log("STEP 1: Define a package with parameter placeholders\n");

const packageDef = {
    name: "@demo/threshold",
    version: "1.0.0",
    gadgets: {
        thresholdCell: {
            parameters: {
                // These are the DEFAULTS
                initialValue: 50,
                fallbackValue: 0,
            },
            template: {
                imports: { cells: "@bassline/cells/numeric" },
                gadgets: {
                    // $parameters.initialValue is a PLACEHOLDER
                    main: {
                        type: "cells.max",
                        state: "$parameters.initialValue", // ← PLACEHOLDER
                    },
                    fallback: {
                        type: "cells.max",
                        state: "$parameters.fallbackValue", // ← PLACEHOLDER
                    },
                },
            },
        },
    },
};

console.log("Package definition:");
console.log(JSON.stringify(packageDef, null, 2));
console.log();

// ============================================================
// STEP 2: Load Package (Creates Proto with Template + Defaults)
// ============================================================
console.log("STEP 2: Load package - creates a proto\n");
console.log("When loaded, the proto stores:");
console.log("  - template (with $parameters.* placeholders)");
console.log("  - parameters (the defaults: { initialValue: 50, fallbackValue: 0 })");
console.log();

loadPackage(packageDef);

// ============================================================
// STEP 3: Spawn Instance #1 (Use Defaults)
// ============================================================
console.log("STEP 3: Spawn with NO parameters - uses defaults\n");

const resolver = createPackageResolver();
resolver.import("demo", "@demo/threshold");

const instance1 = bl().fromSpec(
    { type: "demo.thresholdCell", state: {} }, // ← Empty state!
    resolver,
);

console.log("What happens:");
console.log('  1. proto.spawn({}) is called');
console.log('  2. afterSpawn runs with state = {}');
console.log('  3. resolveParameters finds "$parameters.initialValue"');
console.log('  4. Checks state.initialValue → undefined');
console.log('  5. Checks this.parameters.initialValue → 50 ✓');
console.log('  6. Replaces "$parameters.initialValue" with 50');
console.log('  7. Same for fallbackValue → 0');
console.log();

setTimeout(() => {
    const scope = instance1.current().scope;
    console.log("Result:");
    console.log("  main gadget state:", scope.get("main").current());
    console.log("  fallback gadget state:", scope.get("fallback").current());
    console.log();

    // ============================================================
    // STEP 4: Spawn Instance #2 (Override Defaults)
    // ============================================================
    console.log("STEP 4: Spawn with CUSTOM parameters - overrides defaults\n");

    const instance2 = bl().fromSpec(
        {
            type: "demo.thresholdCell",
            state: {
                initialValue: 100, // ← Custom value!
                fallbackValue: 25, // ← Custom value!
            },
        },
        resolver,
    );

    console.log("What happens:");
    console.log('  1. proto.spawn({ initialValue: 100, fallbackValue: 25 }) is called');
    console.log('  2. afterSpawn runs with state = { initialValue: 100, fallbackValue: 25 }');
    console.log('  3. resolveParameters finds "$parameters.initialValue"');
    console.log('  4. Checks state.initialValue → 100 ✓');
    console.log('  5. Replaces "$parameters.initialValue" with 100');
    console.log('  6. Same for fallbackValue → 25');
    console.log();

    setTimeout(() => {
        const scope2 = instance2.current().scope;
        console.log("Result:");
        console.log("  main gadget state:", scope2.get("main").current());
        console.log("  fallback gadget state:", scope2.get("fallback").current());
        console.log();

        // ============================================================
        // STEP 5: Spawn Instance #3 (Partial Override)
        // ============================================================
        console.log("STEP 5: Spawn with PARTIAL parameters - mixes custom + defaults\n");

        const instance3 = bl().fromSpec(
            {
                type: "demo.thresholdCell",
                state: {
                    initialValue: 200, // ← Custom
                    // fallbackValue not specified, uses default
                },
            },
            resolver,
        );

        console.log("What happens:");
        console.log('  1. proto.spawn({ initialValue: 200 }) is called');
        console.log('  2. resolveParameters finds "$parameters.initialValue"');
        console.log('  3. Checks state.initialValue → 200 ✓');
        console.log('  4. Replaces "$parameters.initialValue" with 200');
        console.log('  5. For "$parameters.fallbackValue":');
        console.log('     - Checks state.fallbackValue → undefined');
        console.log('     - Checks this.parameters.fallbackValue → 0 ✓');
        console.log('  6. Replaces "$parameters.fallbackValue" with 0 (default)');
        console.log();

        setTimeout(() => {
            const scope3 = instance3.current().scope;
            console.log("Result:");
            console.log("  main gadget state:", scope3.get("main").current());
            console.log("  fallback gadget state:", scope3.get("fallback").current());
            console.log();

            // ============================================================
            // KEY INSIGHTS
            // ============================================================
            console.log("=== KEY INSIGHTS ===\n");
            console.log("1. Template is stored ONCE on the proto (not on instances)");
            console.log("   - Contains $parameters.* placeholders\n");

            console.log("2. Defaults are stored ONCE on the proto");
            console.log("   - parameters: { initialValue: 50, fallbackValue: 0 }\n");

            console.log("3. Each spawn resolves parameters:");
            console.log("   - State values override defaults");
            console.log("   - Missing state values fall back to defaults");
            console.log("   - Template is resolved FRESH for each spawn\n");

            console.log("4. Resolution order:");
            console.log("   - state[paramName] (highest priority)");
            console.log("   - proto.parameters[paramName] (fallback)");
            console.log("   - Error if neither exists\n");

            console.log("5. Same proto → multiple instances with different values!");
            console.log("   - instance1: initialValue=50 (default), fallbackValue=0 (default)");
            console.log("   - instance2: initialValue=100 (custom), fallbackValue=25 (custom)");
            console.log("   - instance3: initialValue=200 (custom), fallbackValue=0 (default)");

            console.log("\n✅ This is how you create reusable gadget types!");
            process.exit(0);
        }, 100);
    }, 100);
}, 100);
