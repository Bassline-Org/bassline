#!/usr/bin/env node
/**
 * Core Effect System Test (Browser-Compatible)
 *
 * Demonstrates core effects that work in both Node.js and browsers.
 * No filesystem effects - only console and HTTP.
 */

import { Runtime } from "../src/interactive-runtime.js";
import { formatResults } from "../src/format-results.js";

const rt = new Runtime();
// Note: NOT installing effects-node - this is browser-compatible

console.log("╔═══════════════════════════════════════════════════════╗");
console.log("║   Core Effect System Test (Browser-Compatible)       ║");
console.log("╚═══════════════════════════════════════════════════════╝");
console.log("");

// Test 1: List all effects (should only show core effects)
console.log("1. Query all effects (core only):");
const effects = rt.eval("query [?e TYPE EFFECT!]");
console.log(formatResults(effects));
console.log("");

// Test 2: Execute a LOG effect (sync)
console.log("2. Execute LOG effect:");
rt.eval('fact [log1 { EFFECT LOG INPUT "Core effects work in browser!" }]');

setTimeout(() => {
  const logResult = rt.eval("query [log1 RESULT ?r]");
  console.log("Result:", formatResults(logResult));
  console.log("");

  // Test 3: Query effects by category
  console.log("3. Effects by category:");
  const ioEffects = rt.eval('query [?e CATEGORY "io"]');
  console.log("I/O Effects:", formatResults(ioEffects));
  const httpEffects = rt.eval('query [?e CATEGORY "http"]');
  console.log("HTTP Effects:", formatResults(httpEffects));
  const fsEffects = rt.eval('query [?e CATEGORY "filesystem"]');
  console.log("Filesystem Effects:", formatResults(fsEffects));
  console.log("");

  console.log("✅ Core effects working! (Browser-compatible)");
  console.log("ℹ️  To enable filesystem effects in Node.js:");
  console.log("   import { installNodeEffects } from '../extensions/effects-node/index.js';");
  console.log("   installNodeEffects(runtime.graph);");
}, 100);
