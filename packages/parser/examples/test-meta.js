#!/usr/bin/env node
/**
 * Test self-describing system
 */

import { Runtime } from "../src/interactive-runtime.js";

const rt = new Runtime();

console.log("=== Testing Self-Describing System ===\n");

// Test 1: Query all types
console.log("1. All types in the system:");
const types = rt.eval("query [?t TYPE TYPE!]");
console.log(types.map(b => b.get("?T")));

// Test 2: Query all operations
console.log("\n2. All operations:");
const operations = rt.eval("query [?o TYPE OPERATION!]");
console.log(`Found ${operations.length} operations`);
console.log("First 5:", operations.slice(0, 5).map(b => b.get("?O")));

// Test 3: Query all aggregations
console.log("\n3. All aggregations:");
const aggregations = rt.eval("query [?a TYPE AGGREGATION!]");
console.log(`Found ${aggregations.length} aggregations`);
console.log("All:", aggregations.map(b => b.get("?A")));

// Test 4: Get documentation for an operation
console.log("\n4. Documentation for ADD operation:");
const addDocs = rt.eval("query [ADD DOCS ?d]");
console.log(addDocs.map(b => b.get("?D")));

// Test 5: Create a rule
console.log("\n5. Creating a rule...");
rt.eval("rule ADULT [?p AGE ?a] -> [?p ADULT TRUE]");

// Test 6: Query all rules
console.log("\n6. All rules:");
const rules = rt.eval("query [?r TYPE RULE!]");
console.log(rules.map(b => b.get("?R")));

// Test 7: Create a pattern
console.log("\n7. Creating a pattern...");
rt.eval("pattern PEOPLE [?p AGE ?a]");

// Test 8: Query all patterns
console.log("\n8. All patterns:");
const patterns = rt.eval("query [?p TYPE PATTERN!]");
console.log(patterns.map(b => b.get("?P")));

// Test 9: Create an aggregation instance
console.log("\n9. Creating an aggregation...");
rt.eval("fact [AGG1 AGGREGATE SUM]");
rt.eval("fact [AGG1 ITEM 10]");
rt.eval("fact [AGG1 ITEM 20]");

// Test 10: Query aggregation result
console.log("\n10. Aggregation result:");
const result = rt.eval("query [AGG1 ?key ?value]");
console.log("AGG1 edges:", result);

console.log("\n=== Test Complete ===");
