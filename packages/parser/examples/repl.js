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

// Multi-line input state
let inputBuffer = "";
let bracketDepth = 0;

console.log("╔═══════════════════════════════════════════════════════╗");
console.log("║   Bassline Interactive Runtime                        ║");
console.log("║   Pattern-based graph computation                     ║");
console.log("╚═══════════════════════════════════════════════════════╝");
console.log("");
console.log("Type .help for help, .exit to quit");
console.log("");

rl.prompt();

rl.on("line", (line) => {
  const trimmed = line.trim();

  // Handle empty input
  if (!trimmed && inputBuffer === "") {
    rl.prompt();
    return;
  }

  // Add to buffer
  if (inputBuffer) {
    inputBuffer += "\n" + line;
  } else {
    inputBuffer = line;
  }

  // Update bracket depth
  bracketDepth += countBrackets(line);

  // Check if we have complete input
  if (bracketDepth === 0 && inputBuffer.trim() !== "") {
    const input = inputBuffer.trim();
    inputBuffer = "";

    // Handle REPL commands
    if (input.startsWith(".")) {
      handleReplCommand(input);
      rl.setPrompt("> ");
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

    rl.setPrompt("> ");
    rl.prompt();
  } else if (bracketDepth > 0) {
    // Continuation needed
    rl.setPrompt("... ");
    rl.prompt();
  } else if (bracketDepth < 0) {
    // Unbalanced brackets (more closing than opening)
    console.error("Error: Unbalanced brackets (too many closing brackets)");
    inputBuffer = "";
    bracketDepth = 0;
    rl.setPrompt("> ");
    rl.prompt();
  }
});

/**
 * Count net bracket depth change in a line
 * Handles strings to avoid counting brackets inside them
 */
function countBrackets(line) {
  let depth = 0;
  let inString = false;
  let stringChar = null;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const prevChar = i > 0 ? line[i - 1] : null;

    // Handle string boundaries (skip escaped quotes)
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }

    // Count brackets only outside strings
    if (!inString) {
      if (char === "[") {
        depth++;
      } else if (char === "]") {
        depth--;
      }
    }
  }

  return depth;
}

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
  console.log("  alice          Expands to: query [alice ?attr ?target]");
  console.log("");
  console.log("System Reflection (via queries):");
  console.log("  query [?r TYPE RULE!]        List all rules");
  console.log("  query [?p TYPE PATTERN!]     List all patterns");
  console.log("  query [?o TYPE OPERATION!]   List all operations");
  console.log("  query [?a TYPE AGGREGATION!] List all aggregations");
  console.log("  query [?t TYPE TYPE!]        List all types");
  console.log("  query [ADD DOCS ?d]          Get operation documentation");
  console.log("");
  console.log("Examples:");
  console.log("  fact [alice age 30 bob age 25]");
  console.log("  query [?x age ?a]");
  console.log("  rule adult [?p age ?a] -> [?p adult true]");
  console.log("  alice");
  console.log("  query [?t TYPE TYPE!]");
}
