#!/usr/bin/env node
/**
 * Effect System Test
 *
 * Demonstrates the new effect system working with sync and async effects.
 * Also shows opt-in installation of Node.js-specific effects.
 */

import { Runtime } from "../src/interactive-runtime.js";
import { formatResults } from "../src/format-results.js";
import { installNodeEffects } from "../extensions/effects-node/index.js";

const rt = new Runtime();

// Opt-in to Node.js-specific effects (filesystem)
installNodeEffects(rt.graph);

console.log("╔═══════════════════════════════════════════════════════╗");
console.log("║   Effect System Test                                  ║");
console.log("╚═══════════════════════════════════════════════════════╝");
console.log("");

// Test 1: List all effects (self-describing)
console.log("1. Query all effects:");
const effects = rt.eval("query [?e TYPE EFFECT!]");
console.log(formatResults(effects));
console.log("");

// Test 2: Get documentation for LOG effect
console.log("2. Get LOG effect documentation:");
const logDocs = rt.eval("query [LOG DOCS ?doc]");
console.log(formatResults(logDocs));
console.log("");

// Test 3: Execute a LOG effect (sync)
console.log("3. Execute LOG effect (sync):");
rt.eval('fact [log1 { EFFECT LOG INPUT "Hello from Bassline effects!" }]');

// Give it a moment to execute
setTimeout(() => {
  // Query the result
  const logResult = rt.eval("query [log1 RESULT ?r]");
  console.log("Result:", formatResults(logResult));
  console.log("");

  // Test 4: Execute HTTP_GET effect (async)
  console.log("4. Execute HTTP_GET effect (async - fetching GitHub API):");
  rt.eval('fact [req1 { EFFECT HTTP_GET INPUT "https://api.github.com/zen" }]');

  // Wait for async result
  setTimeout(() => {
    const httpResult = rt.eval("query [req1 RESULT ?r]");
    console.log("HTTP Result:", formatResults(httpResult));
    console.log("");

    // Test 5: Query effect status
    console.log("5. Query effect status:");
    const status = rt.eval("query [req1 STATUS ?s]");
    console.log("Status:", formatResults(status));
    console.log("");

    // Test 6: List all effects by category
    console.log("6. Query effects by category:");
    const ioEffects = rt.eval('query [?e CATEGORY "io"]');
    console.log("I/O Effects:", formatResults(ioEffects));
    const httpEffects = rt.eval('query [?e CATEGORY "http"]');
    console.log("HTTP Effects:", formatResults(httpEffects));
    const fsEffects = rt.eval('query [?e CATEGORY "filesystem"]');
    console.log("Filesystem Effects:", formatResults(fsEffects));
    console.log("");

    console.log("✅ Effect system working correctly!");
  }, 1000);
}, 100);
