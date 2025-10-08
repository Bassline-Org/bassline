import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
import { installRegistry } from "./extensions/registry.js";
import { createCompoundProto } from "./compoundProto.js";
bl();
installTaps();
installRegistry();

import cells from "./patterns/cells/index.js";
import functions from "./patterns/functions/index.js";
import refs from "./patterns/refs/index.js";
import relations from "./patterns/relations/relationGadgets.js";
import systems from "./patterns/systems/index.js";

installPackage(cells);
installPackage(functions);
installPackage(refs);
installPackage(relations);
installPackage(systems);

// Test compound gadget with SHORT-FORM SPECS!
// Before: { pkg: "@bassline/cells/numeric", name: "max", state: 0 }
// After:  { type: "cells.max", state: 0 }
// 75% reduction in spec size!
const compoundSpec = {
    pkg: "@bassline/compound",
    name: "compound",
    state: {
        // Define imports for this compound
        imports: {
            cells: "@bassline/cells/numeric",
            unsafe: "@bassline/cells/unsafe",
            wire: "@bassline/relations",
        },
        // Now use short-form specs with type aliases
        gadgets: {
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
        interface: {
            inputs: { value: "input" },
            outputs: { result: "output" },
        },
    },
};

console.log("\n=== Testing Compound Gadget ===");
const myCompound = bl().fromSpec(compoundSpec);

myCompound.tap((effects) => {
    console.log("Compound emitted:", effects);
});

// Give async resolution time to complete
setTimeout(() => {
    console.log("Sending value: 42");
    myCompound.receive({ value: 42 });

    setTimeout(() => {
        console.log("Sending value: 100");
        myCompound.receive({ value: 100 });

        setTimeout(() => {
            console.log("Sending value: 50 (should be rejected by max cell)");
            myCompound.receive({ value: 50 });

            setTimeout(() => {
                const scope = myCompound.current().scope;
                console.log("\nFinal state:");
                console.log("  input:", scope.get("input").current());
                console.log("  output:", scope.get("output").current());
                console.log("\n✅ Compound gadget test complete!");
                process.exit(0);
            }, 500);
        }, 500);
    }, 500);
}, 1000);

// Demo: Creating a custom ref type is trivial now!
import { createRefType } from "./patterns/refs/refs.js";

console.log("\n=== Custom Ref Type Demo ===");

// Create a simple key-value store ref
const kvStore = new Map([
    ["user1", { name: "Alice", role: "admin" }],
    ["user2", { name: "Bob", role: "user" }],
]);

const kvRef = createRefType({
    name: "kvRef",
    keyFields: ["key"],
    resolver: (key) => kvStore.get(key),
});
kvRef.pkg = "@demo/refs";

const userRef = kvRef.spawn({ key: "user1" });
userRef.promise.then((user) => {
    console.log("User resolved:", user);
    console.log("✅ Custom ref type demo complete!\n");
});
// === Testing Compound Proto Factory ===
console.log("\n=== Testing Compound Proto Factory ===");

// Define a reusable "threshold filter" template
const thresholdFilterTemplate = {
    imports: {
        cells: "@bassline/cells/numeric",
        unsafe: "@bassline/cells/unsafe",
        wire: "@bassline/relations",
    },
    gadgets: {
        threshold: { type: "cells.max", state: "$parameters.threshold" },
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
    interface: {
        inputs: { value: "input", min: "threshold" },
        outputs: { result: "output" },
    },
};

// Create a reusable proto from the template
const thresholdFilter = createCompoundProto(thresholdFilterTemplate, {
    name: "thresholdFilter",
    pkg: "@demo/filters",
    parameters: {
        threshold: 10, // Default threshold
    },
});

// Install it so we can use it via fromSpec
installPackage({
    name: "@demo/filters",
    gadgets: { thresholdFilter },
});

// Now we can spawn instances with different thresholds!
const filter50 = thresholdFilter.spawn({ threshold: 50 });
const filter100 = thresholdFilter.spawn({ threshold: 100 });

filter50.tap((effects) => {
    console.log("Filter50 emitted:", effects);
});

filter100.tap((effects) => {
    console.log("Filter100 emitted:", effects);
});

// Test after resolution
setTimeout(() => {
    console.log("\nTesting filter50 (threshold=50):");
    filter50.receive({ value: 30 });
    setTimeout(() => filter50.receive({ value: 75 }), 100);

    setTimeout(() => {
        console.log("\nTesting filter100 (threshold=100):");
        filter100.receive({ value: 80 });
        setTimeout(() => filter100.receive({ value: 150 }), 100);

        setTimeout(() => {
            console.log("\n✅ Compound proto factory test complete!");
            console.log(
                "Successfully created reusable compound proto with parameters!",
            );
        }, 500);
    }, 500);
}, 1000);
