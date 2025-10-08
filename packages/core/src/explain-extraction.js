/**
 * PARAMETER EXTRACTION EXPLAINED
 *
 * The problem: You have a compound spec with concrete values.
 * The goal: Convert it to a reusable package with parameters.
 *
 * This walkthrough shows what extractParameters() does step-by-step.
 */

console.log("=== PARAMETER EXTRACTION WALKTHROUGH ===\n");

// ============================================================
// THE PROBLEM
// ============================================================
console.log("THE PROBLEM:\n");
console.log("You have this compound spec:");

const originalSpec = {
    pkg: "@bassline/compound",
    name: "compound",
    state: {
        imports: { cells: "@bassline/cells/numeric" },
        gadgets: {
            minThreshold: { type: "cells.max", state: 50 },  // ← Concrete value!
            maxThreshold: { type: "cells.min", state: 200 }, // ← Concrete value!
            input: { type: "cells.max", state: 0 },
            output: { type: "cells.last", state: 0 },
        },
    },
};

console.log(JSON.stringify(originalSpec.state.gadgets, null, 2));
console.log();

console.log("You want to make a reusable package where users can set different thresholds.");
console.log("But you don't want to manually figure out all the paths and write this:\n");
console.log("  parameterizeSpec(spec, {");
console.log('    "state.gadgets.minThreshold.state": "minThreshold",');
console.log('    "state.gadgets.maxThreshold.state": "maxThreshold"');
console.log("  });\n");
console.log("That's tedious and error-prone!\n");

// ============================================================
// THE SOLUTION
// ============================================================
console.log("THE SOLUTION: extractParameters()\n");

// Simulate what extractParameters does step by step

console.log("STEP 1: Detect which gadgets to parameterize\n");
console.log('  extractParameters(spec, { include: ["minThreshold", "maxThreshold"] })');
console.log();

const include = ["minThreshold", "maxThreshold"];

console.log("STEP 2: Scan the gadgets object\n");
const gadgets = originalSpec.state.gadgets;

const detected = {};
console.log("  For each gadget in spec.state.gadgets:");
for (const [gadgetName, gadgetSpec] of Object.entries(gadgets)) {
    console.log(`\n  - ${gadgetName}: { type: "${gadgetSpec.type}", state: ${JSON.stringify(gadgetSpec.state)} }`);

    if (!include.includes(gadgetName)) {
        console.log(`    ✗ Not in include list, skip`);
        continue;
    }

    const state = gadgetSpec.state;

    // Check if state is a primitive (number, string, boolean)
    if (typeof state !== "object") {
        const path = `state.gadgets.${gadgetName}.state`;
        const paramName = gadgetName;

        console.log(`    ✓ State is primitive (${typeof state})`);
        console.log(`    → Path: "${path}"`);
        console.log(`    → Param name: "${paramName}"`);
        console.log(`    → Current value: ${state}`);

        detected[path] = paramName;
    } else {
        console.log(`    ✗ State is object/array, skip`);
    }
}

console.log("\n\nSTEP 3: Build the path-to-name mapping\n");
console.log("  detected =", JSON.stringify(detected, null, 2));
console.log();

console.log("STEP 4: Extract current values as defaults\n");
const parameters = {};
console.log("  For each detected path:");
for (const [path, paramName] of Object.entries(detected)) {
    // Navigate to the value
    // path = "state.gadgets.minThreshold.state"
    // Split into: ["state", "gadgets", "minThreshold", "state"]
    const parts = path.split(".");
    console.log(`\n  - Path: "${path}"`);
    console.log(`    Parts: [${parts.map((p) => `"${p}"`).join(", ")}]`);

    // Navigate
    let obj = originalSpec;
    for (let i = 0; i < parts.length - 1; i++) {
        console.log(`    Navigate: obj = obj["${parts[i]}"]`);
        obj = obj[parts[i]];
    }

    const lastPart = parts[parts.length - 1];
    const value = obj[lastPart];

    console.log(`    Get value: obj["${lastPart}"] = ${value}`);
    console.log(`    → parameters.${paramName} = ${value}`);

    parameters[paramName] = value;
}

console.log("\n\nSTEP 5: Replace values with $parameters.* placeholders\n");
console.log("  Using parameterizeSpec(spec, detected)...");
console.log();

// Simulate parameterizeSpec
const parameterized = JSON.parse(JSON.stringify(originalSpec));
for (const [path, paramName] of Object.entries(detected)) {
    const parts = path.split(".");
    let obj = parameterized;

    for (let i = 0; i < parts.length - 1; i++) {
        obj = obj[parts[i]];
    }

    const lastPart = parts[parts.length - 1];
    const oldValue = obj[lastPart];
    const newValue = `$parameters.${paramName}`;

    console.log(`  Replace at "${path}":`);
    console.log(`    ${oldValue} → "${newValue}"`);

    obj[lastPart] = newValue;
}

console.log("\n\nRESULT:\n");
console.log("Parameterized gadgets:");
console.log(JSON.stringify(parameterized.state.gadgets, null, 2));
console.log();

console.log("Parameter defaults:");
console.log(JSON.stringify(parameters, null, 2));
console.log();

// ============================================================
// THE MAGIC
// ============================================================
console.log("=== THE MAGIC ===\n");
console.log("OLD WAY (manual):");
console.log("  1. Look at spec, find paths to values you want configurable");
console.log('  2. Write { "state.gadgets.minThreshold.state": "minThreshold", ... }');
console.log("  3. Call parameterizeSpec(spec, pathMap)");
console.log("  4. Manually build { minThreshold: 50, maxThreshold: 200 }");
console.log("  5. Export\n");

console.log("NEW WAY (automatic):");
console.log("  1. Call extractParameters(spec, { include: ['minThreshold', 'maxThreshold'] })");
console.log("  2. Done! ✨\n");

console.log("extractParameters() returns:");
console.log("  {");
console.log("    spec: /* parameterized spec with $parameters.* */,");
console.log("    parameters: /* defaults extracted from current values */");
console.log("  }\n");

console.log("You just say WHICH gadgets to parameterize.");
console.log("The function figures out HOW to parameterize them.");
console.log("And it extracts the current values as defaults automatically!\n");

console.log("✅ No manual path specifications needed!");
