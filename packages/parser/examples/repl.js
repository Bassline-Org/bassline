#!/usr/bin/env node
/**
 * Bassline Interactive REPL
 *
 * An interactive command-line interface for the Bassline pattern-based language.
 *
 * Usage:
 *   node examples/repl.js
 *
 * Commands:
 *   - Any pattern language expression (fact, query, rule, pattern, watch, etc.)
 *   - Single words to explore entities (e.g., "alice" → query [alice * *])
 *   - .help - Show help
 *   - .stats - Show graph statistics
 *   - .patterns - List active patterns
 *   - .rules - List active rules
 *   - .reset - Clear everything
 *   - .exit or .quit - Exit REPL
 */

import * as readline from "readline";
import { Runtime } from "../src/interactive-runtime.js";
import { formatResults } from "../src/format-results.js";

const rt = new Runtime();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

console.log("╔═══════════════════════════════════════════════════════╗");
console.log("║   Bassline Interactive Runtime                        ║");
console.log("║   Pattern-based graph computation                     ║");
console.log("╚═══════════════════════════════════════════════════════╝");
console.log("");
console.log("Type .help for help, .exit to quit");
console.log("");

rl.prompt();

rl.on("line", (line) => {
  const input = line.trim();

  // Handle empty input
  if (!input) {
    rl.prompt();
    return;
  }

  // Handle REPL commands
  if (input.startsWith(".")) {
    handleReplCommand(input);
    rl.prompt();
    return;
  }

  // Execute pattern language expression
  try {
    const results = rt.eval(input);
    console.log(formatResults(results));
  } catch (err) {
    console.error("Error:", err.message);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
  }

  rl.prompt();
});

rl.on("close", () => {
  console.log("\nBye!");
  process.exit(0);
});

/**
 * Handle REPL meta-commands (starting with .)
 */
function handleReplCommand(cmd) {
  const parts = cmd.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();

  switch (command) {
    case "help":
    case "h":
      showHelp();
      break;

    case "stats":
      showStats();
      break;

    case "patterns":
      showPatterns();
      break;

    case "rules":
      showRules();
      break;

    case "reset":
      rt.reset();
      console.log("Runtime reset (graph cleared, all watchers removed)");
      break;

    case "exit":
    case "quit":
    case "q":
      rl.close();
      break;

    default:
      console.log(`Unknown command: ${cmd}`);
      console.log("Type .help for available commands");
  }
}

function showHelp() {
  console.log("REPL Commands:");
  console.log("  .help          Show this help");
  console.log("  .stats         Show graph statistics");
  console.log("  .patterns      List active patterns");
  console.log("  .rules         List active rules");
  console.log("  .reset         Clear graph and remove all watchers");
  console.log("  .exit          Exit REPL");
  console.log("");
  console.log("Pattern Language:");
  console.log("  fact [...]     Add facts to graph");
  console.log("  query [...]    Query the graph");
  console.log("  rule name [...] -> [...]  Create rewrite rule");
  console.log("  pattern name [...]  Create named pattern");
  console.log("  watch [...] [...]  Watch and react");
  console.log("  delete s a t   Mark triple as deleted");
  console.log("  clear-graph    Clear all edges");
  console.log("  graph-info     Show graph statistics");
  console.log("");
  console.log("Single-word Shorthand:");
  console.log("  alice          Expands to: query [alice * *]");
  console.log("");
  console.log("Examples:");
  console.log("  fact [alice age 30 bob age 25]");
  console.log("  query [?x age ?a]");
  console.log("  rule adult [?p age ?a] -> [?p adult true]");
  console.log("  alice");
}

function showStats() {
  const stats = rt.getStats();
  console.log("Graph Statistics:");
  console.log(`  Edges:    ${stats.edges}`);
  console.log(`  Patterns: ${stats.patterns}`);
  console.log(`  Rules:    ${stats.rules}`);
}

function showPatterns() {
  const patterns = rt.getActivePatterns();
  if (patterns.length === 0) {
    console.log("No active patterns");
  } else {
    console.log(`Active Patterns (${patterns.length}):`);
    patterns.forEach((p) => console.log(`  - ${p}`));
  }
}

function showRules() {
  const rules = rt.getActiveRules();
  if (rules.length === 0) {
    console.log("No active rules");
  } else {
    console.log(`Active Rules (${rules.length}):`);
    rules.forEach((r) => console.log(`  - ${r}`));
  }
}
