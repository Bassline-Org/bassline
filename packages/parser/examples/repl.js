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
 *   - .checkpoint / .cp [name] - Create checkpoint
 *   - .restore [name] - Restore checkpoint (or list if no name)
 *   - .undo [N] - Undo last N commands
 *   - .history [N] - Show command history
 *   - .save <file> - Save session to file
 *   - .load <file> - Load session from file
 *   - .reset - Clear everything
 *   - .exit or .quit - Exit REPL
 */

import * as readline from "readline";
import * as fs from "fs";
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

    case "checkpoint":
    case "cp":
      const cpName = parts[1] || `cp-${Date.now()}`;
      rt.checkpoint(cpName);
      console.log(`Checkpoint created: ${cpName}`);
      break;

    case "restore":
      if (!parts[1]) {
        const cps = rt.listCheckpoints();
        if (cps.length === 0) {
          console.log("No checkpoints available");
        } else {
          console.log("Available checkpoints:");
          cps.forEach(cp => console.log(`  ${cp.name} (${new Date(cp.timestamp).toLocaleTimeString()})`));
        }
      } else {
        try {
          rt.restore(parts[1]);
          console.log(`Restored to checkpoint: ${parts[1]}`);
        } catch (err) {
          console.error(`Error: ${err.message}`);
        }
      }
      break;

    case "undo":
      const count = parseInt(parts[1]) || 1;
      try {
        rt.undo(count);
        console.log(`Undid ${count} command(s)`);
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }
      break;

    case "history":
      const histCount = parseInt(parts[1]) || 10;
      const history = rt.getHistory(histCount);
      if (history.length === 0) {
        console.log("(no history)");
      } else {
        history.forEach((cmd, i) => {
          console.log(`  ${i + 1}. ${cmd}`);
        });
      }
      break;

    case "save":
      if (!parts[1]) {
        console.log("Usage: .save <filename>");
        break;
      }
      try {
        const data = rt.toJSON();
        data.evalHistory = rt.evalHistory;
        data.checkpoints = Array.from(rt.checkpoints.values());
        fs.writeFileSync(parts[1], JSON.stringify(data, null, 2));
        console.log(`Saved to ${parts[1]}`);
      } catch (err) {
        console.error(`Error saving: ${err.message}`);
      }
      break;

    case "load":
      if (!parts[1]) {
        console.log("Usage: .load <filename>");
        break;
      }
      try {
        const data = JSON.parse(fs.readFileSync(parts[1], 'utf8'));
        rt.fromJSON(data);

        // Restore history and checkpoints if present
        if (data.evalHistory) {
          rt.evalHistory = data.evalHistory;
        }
        if (data.checkpoints) {
          rt.checkpoints = new Map(data.checkpoints.map(cp => [cp.name, cp]));
        }

        console.log(`Loaded ${data.edges?.length || 0} edges from ${parts[1]}`);
        if (data.evalHistory) {
          console.log(`Restored ${data.evalHistory.length} commands in history`);
        }
        if (data.checkpoints) {
          console.log(`Restored ${data.checkpoints.length} checkpoint(s)`);
        }
      } catch (err) {
        console.error(`Error loading: ${err.message}`);
      }
      break;

    case "save-checkpoint":
    case "savecp":
      if (!parts[1] || !parts[2]) {
        console.log("Usage: .save-checkpoint <checkpoint-name> <filename>");
        break;
      }
      try {
        const cp = rt.checkpoints.get(parts[1]);
        if (!cp) {
          console.error(`Checkpoint not found: ${parts[1]}`);
          break;
        }
        const historyToSave = rt.evalHistory.slice(0, cp.historyIndex);
        const data = {
          checkpoint: cp,
          evalHistory: historyToSave
        };
        fs.writeFileSync(parts[2], JSON.stringify(data, null, 2));
        console.log(`Saved checkpoint '${parts[1]}' to ${parts[2]}`);
      } catch (err) {
        console.error(`Error saving checkpoint: ${err.message}`);
      }
      break;

    case "load-checkpoint":
    case "loadcp":
      if (!parts[1]) {
        console.log("Usage: .load-checkpoint <filename>");
        break;
      }
      try {
        const data = JSON.parse(fs.readFileSync(parts[1], 'utf8'));
        rt.reset();
        rt.evalHistory = [];

        // Replay history
        if (data.evalHistory) {
          data.evalHistory.forEach(cmd => {
            rt._executeEval(cmd);
            rt.evalHistory.push(cmd);
          });
        }

        // Restore checkpoint
        if (data.checkpoint) {
          rt.checkpoints.set(data.checkpoint.name, data.checkpoint);
        }

        console.log(`Loaded checkpoint from ${parts[1]}`);
        console.log(`Restored ${data.evalHistory?.length || 0} commands`);
      } catch (err) {
        console.error(`Error loading checkpoint: ${err.message}`);
      }
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
  console.log("  .help                          Show this help");
  console.log("  .checkpoint [name] / .cp       Create checkpoint");
  console.log("  .restore [name]                Restore checkpoint (or list all)");
  console.log("  .undo [N]                      Undo last N commands (default: 1)");
  console.log("  .history [N]                   Show last N commands (default: 10)");
  console.log("  .save <file>                   Save session with history");
  console.log("  .load <file>                   Load session from file");
  console.log("  .save-checkpoint <cp> <file>   Save specific checkpoint");
  console.log("  .load-checkpoint <file>        Load checkpoint from file");
  console.log("  .reset                         Clear graph and remove all watchers");
  console.log("  .exit / .quit                  Exit REPL");
  console.log("");
  console.log("Pattern Language:");
  console.log("  fact [...]                     Add facts to graph");
  console.log("  query [...]                    Query the graph");
  console.log("  rule name [...] -> [...]       Create rewrite rule");
  console.log("  pattern name [...]             Create named pattern");
  console.log("  watch [...] [...]              Watch and react");
  console.log("  delete s a t                   Mark triple as deleted");
  console.log("  clear-graph                    Clear all edges");
  console.log("  graph-info                     Show graph statistics");
  console.log("");
  console.log("Single-word Shorthand:");
  console.log("  alice                          Expands to: query [alice ?attr ?target]");
  console.log("");
  console.log("System Reflection (via queries):");
  console.log("  query [?r TYPE RULE!]          List all rules");
  console.log("  query [?p TYPE PATTERN!]       List all patterns");
  console.log("  query [?o TYPE OPERATION!]     List all operations");
  console.log("  query [?a TYPE AGGREGATION!]   List all aggregations");
  console.log("  query [?e TYPE EFFECT!]        List all effects");
  console.log("  query [?t TYPE TYPE!]          List all types");
  console.log("  query [ADD DOCS ?d]            Get operation documentation");
  console.log("");
  console.log("Effects (Side-Effects):");
  console.log("  fact [log1 { EFFECT LOG INPUT \"msg\" }]   Execute LOG effect");
  console.log("  query [log1 RESULT ?r]                     Query effect result");
  console.log("  (Note: Filesystem effects require Node.js and opt-in installation)");
  console.log("");
  console.log("Examples:");
  console.log("  fact [alice age 30 bob age 25]");
  console.log("  query [?x age ?a]");
  console.log("  rule adult [?p age ?a] -> [?p adult true]");
  console.log("  .checkpoint before-experiment");
  console.log("  alice");
  console.log("  query [?t TYPE TYPE!]");
}
