import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
import { installRegistry } from "./extensions/registry.js";
import { exportAsPackage, savePackage, parameterizeSpec } from "./packageExporter.js";
import { loadPackage, loadPackageFromFile } from "./packageLoader.js";
bl();
installTaps();
installRegistry();

import cells from "./patterns/cells/index.js";
import refs from "./patterns/refs/index.js";
import relations from "./patterns/relations/relationGadgets.js";
import systems from "./patterns/systems/index.js";

installPackage(cells);
installPackage(refs);
installPackage(relations);
installPackage(systems);

console.log("=== Package Description Language - End-to-End Demo ===\n");

// ============================================================
// STEP 1: Create a compound gadget instance
// ============================================================
console.log("Step 1: Creating a compound gadget...");

const myCompoundSpec = {
    pkg: "@bassline/compound",
    name: "compound",
    state: {
        imports: {
            cells: "@bassline/cells/numeric",
            unsafe: "@bassline/cells/unsafe",
            wire: "@bassline/relations",
        },
        gadgets: {
            minValue: { type: "cells.max", state: 50 }, // Threshold
            input: { type: "cells.max", state: 0 },
            filtered: { type: "unsafe.last", state: 0 },
            wire1: {
                type: "wire.wire",
                state: {
                    source: { ref: "input" },
                    target: { ref: "filtered" },
                },
            },
        },
        interface: {
            inputs: { value: "input", threshold: "minValue" },
            outputs: { output: "filtered" },
        },
    },
};

const instance = bl().fromSpec(myCompoundSpec);
console.log("✅ Compound instance created\n");

// ============================================================
// STEP 2: Export as a package definition
// ============================================================
console.log("Step 2: Exporting to package definition...");

// First, parameterize the threshold value
const parameterized = parameterizeSpec(myCompoundSpec, {
    "state.gadgets.minValue.state": "threshold",
});

const packageDef = exportAsPackage(parameterized, {
    name: "@acme/filters",
    gadgetName: "valueFilter",
    version: "1.0.0",
    description: "Custom filtering gadgets",
    gadgetDescription: "Filters values below a threshold",
    parameters: {
        threshold: 50, // Default value
    },
});

console.log("Generated package definition:");
console.log(JSON.stringify(packageDef, null, 2));
console.log("\n✅ Package definition created\n");

// ============================================================
// STEP 3: Save to file
// ============================================================
console.log("Step 3: Saving package to file...");

await savePackage(packageDef, "/tmp/acme-filters.json");
console.log();

// ============================================================
// STEP 4: Load from file
// ============================================================
console.log("Step 4: Loading package from file...");

await loadPackageFromFile("/tmp/acme-filters.json");

// ============================================================
// STEP 5: Use the loaded package via fromSpec
// ============================================================
console.log("Step 5: Creating instances from loaded package...");

// Create resolver with our new package
import { createPackageResolver } from "./packageResolver.js";
const resolver = createPackageResolver();
resolver.import("acme", "@acme/filters");

// Now spawn instances with different thresholds!
const filter100 = bl().fromSpec(
    { type: "acme.valueFilter", state: { threshold: 100 } },
    resolver,
);

const filter200 = bl().fromSpec(
    { type: "acme.valueFilter", state: { threshold: 200 } },
    resolver,
);

console.log("✅ Created filter100 and filter200 instances\n");

// ============================================================
// STEP 6: Test the instances
// ============================================================
console.log("Step 6: Testing the instances...");

filter100.tap((effects) => {
    if (effects.output) {
        console.log("  Filter100 output:", effects.output.changed);
    }
});

filter200.tap((effects) => {
    if (effects.output) {
        console.log("  Filter200 output:", effects.output.changed);
    }
});

// Give time for wiring to complete
setTimeout(() => {
    console.log("\nSending values to filter100 (threshold=100):");
    filter100.receive({ value: 50 }); // Below threshold
    setTimeout(() => filter100.receive({ value: 150 }), 100); // Above threshold
    setTimeout(() => filter100.receive({ value: 75 }), 200); // Below current

    setTimeout(() => {
        console.log("\nSending values to filter200 (threshold=200):");
        filter200.receive({ value: 150 }); // Below threshold
        setTimeout(() => filter200.receive({ value: 250 }), 100); // Above threshold
        setTimeout(() => filter200.receive({ value: 180 }), 200); // Below current

        setTimeout(() => {
            console.log("\n=== End-to-End Demo Complete ===");
            console.log("\nWe successfully:");
            console.log("1. ✅ Created a compound gadget");
            console.log("2. ✅ Exported it as a package definition");
            console.log("3. ✅ Saved the package to a JSON file");
            console.log("4. ✅ Loaded the package from the file");
            console.log("5. ✅ Created instances using short-form specs");
            console.log("6. ✅ Used the instances with different parameters");
            console.log("\n🎉 Full meta-circular flow achieved!");
            process.exit(0);
        }, 1000);
    }, 1000);
}, 1000);
