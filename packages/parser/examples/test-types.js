#!/usr/bin/env node
/**
 * Test that all types are properly registered
 */

import { Runtime } from "../src/interactive-runtime.js";

const rt = new Runtime();

console.log("=== Testing Type Registration ===\n");

// Query types at start
console.log("1. Types at startup:");
let types = rt.eval("query [?t TYPE TYPE!]");
console.log(types.map(b => b.get("?T")));

// Create a rule
rt.eval("rule TEST [?x AGE ?a] -> [?x ADULT TRUE]");

// Query types after rule
console.log("\n2. Types after creating a rule:");
types = rt.eval("query [?t TYPE TYPE!]");
console.log(types.map(b => b.get("?T")));

// Create a pattern
rt.eval("pattern PAT [?p NAME ?n]");

// Query types after pattern
console.log("\n3. Types after creating a pattern:");
types = rt.eval("query [?t TYPE TYPE!]");
console.log(types.map(b => b.get("?T")));

// Create a tombstone (delete)
rt.eval("fact [ALICE AGE 30]");
rt.eval("delete ALICE AGE 30");

// Query types after delete
console.log("\n4. Types after delete:");
types = rt.eval("query [?t TYPE TYPE!]");
console.log(types.map(b => b.get("?T")));

// Verify TYPE! itself has TYPE TYPE!
console.log("\n5. Does TYPE! have TYPE TYPE!?");
const typeType = rt.eval("query [TYPE! TYPE TYPE!]");
console.log(typeType.length > 0 ? "Yes!" : "No");

console.log("\n=== Test Complete ===");
