import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
import { detectParameters, extractParameters, exportAsPackage } from "./packageExporter.js";
bl();
installTaps();

import cells from "./patterns/cells/index.js";
import refs from "./patterns/refs/index.js";
import relations from "./patterns/relations/relationGadgets.js";
import systems from "./patterns/systems/index.js";

installPackage(cells);
installPackage(refs);
installPackage(relations);
installPackage(systems);

console.log("=== Auto-Parameter Extraction Demo ===\n");

// Create a compound with values we want to parameterize
const compoundSpec = {
    pkg: "@bassline/compound",
    name: "compound",
    state: {
        imports: {
            cells: "@bassline/cells/numeric",
            unsafe: "@bassline/cells/unsafe",
            wire: "@bassline/relations",
        },
        gadgets: {
            minThreshold: { type: "cells.max", state: 50 },
            maxThreshold: { type: "cells.min", state: 200 },
            input: { type: "cells.max", state: 0 },
            output: { type: "unsafe.last", state: 0 },
            wire1: {
                type: "wire.wire",
                state: {
                    source: { ref: "input" },
                    target: { ref: "output" },
                },
            },
        },
    },
};

// Step 1: Detect potential parameters
console.log("Step 1: Detecting potential parameters...");
const detected = detectParameters(compoundSpec);
console.log("Detected:", detected);
console.log();

// Step 2: Smart extraction with defaults
console.log("Step 2: Smart extraction with defaults...");
const { spec: extracted, parameters } = extractParameters(compoundSpec, {
    include: ["minThreshold", "maxThreshold"], // Only these gadgets
});

console.log("Extracted parameters:", parameters);
console.log("\nParameterized spec:");
console.log(JSON.stringify(extracted.state.gadgets, null, 2));
console.log();

// Step 3: Export using extracted parameters
console.log("Step 3: Exporting with auto-extracted parameters...");
const packageDef = exportAsPackage(extracted, {
    name: "@demo/range-filter",
    gadgetName: "rangeFilter",
    parameters,
    description: "Filters values within a range",
});

console.log("Generated package:");
console.log(JSON.stringify(packageDef, null, 2));
console.log();

// Step 4: Compare old vs new workflow
console.log("=== Workflow Comparison ===\n");

console.log("OLD workflow (manual):");
console.log("1. Create compound spec");
console.log("2. Manually identify: 'state.gadgets.minThreshold.state' -> 'minThreshold'");
console.log("3. Call parameterizeSpec({ 'state.gadgets.minThreshold.state': 'minThreshold', ... })");
console.log("4. Manually build parameters object: { minThreshold: 50, maxThreshold: 200 }");
console.log("5. Export");
console.log();

console.log("NEW workflow (automatic):");
console.log("1. Create compound spec");
console.log("2. Call extractParameters(spec, { include: ['minThreshold', 'maxThreshold'] })");
console.log("3. Export with extracted parameters");
console.log();

console.log("✅ Much easier! The system detected the values and created parameter defaults automatically.");
