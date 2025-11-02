/**
 * Semantic Evaluation Example
 *
 * This demonstrates how to use graph patterns to implement
 * a simple evaluator for a Rebol-like language.
 */

import { Graph } from "../src/minimal-graph.js";
import { installPatternWords } from "../src/pattern-words.js";
import { parse } from "../src/parser.js";
import { TYPES } from "../src/data.js";

// Create graph and runtime
const g = new Graph();
const runtime = {
  builtins: {},
  eval: evaluateBlock,
};

installPatternWords(runtime, g);

// Simple evaluator for blocks
function evaluateBlock(ctx, block) {
  if (block.type !== TYPES.block) {
    return block;
  }

  const results = [];
  for (const item of block.value) {
    if (item.type === TYPES.word && runtime.builtins[item.value]) {
      // It's a builtin word - execute it
      const func = runtime.builtins[item.value];
      // Collect next args (simplified - real parser would be smarter)
      const args = [];
      // ... would collect appropriate args
      results.push(func(ctx, ...args));
    } else {
      results.push(item);
    }
  }

  return results;
}

// =============================================================================
// Define Semantic Rules Using Patterns
// =============================================================================

console.log("Setting up semantic evaluation rules...\n");

// Rule 1: When we see a PRINT word followed by a value, output it
runtime.builtins.rule(
  {},
  { type: TYPES.word, value: "print-rule" },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "block" }, // :block
      { type: TYPES.getWord, value: "index" }, // :index
      { type: TYPES.getWord, value: "word" }, // :word (the word at index)
    ],
  },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.word, value: "CONSOLE" },
      { type: TYPES.word, value: "OUTPUT" },
      { type: TYPES.getWord, value: "word" }, // Output the word
    ],
  },
);

// Additional rule to check for PRINT spelling
runtime.builtins.pattern(
  {},
  { type: TYPES.word, value: "find-print" },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "word" },
      { type: TYPES.word, value: "SPELLING?" },
      { type: TYPES.word, value: "PRINT" },
    ],
  },
);

// Rule 2: Math operations
runtime.builtins.rule(
  {},
  { type: TYPES.word, value: "add-rule" },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "op" },
      { type: TYPES.word, value: "SPELLING?" },
      { type: TYPES.word, value: "ADD" },
    ],
  },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "op" },
      { type: TYPES.word, value: "NEEDS_EVAL" },
      { type: TYPES.word, value: "true" },
    ],
  },
);

// Rule 3: Variable binding
runtime.builtins.rule(
  {},
  { type: TYPES.word, value: "setword-rule" },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "setword" },
      { type: TYPES.word, value: "TYPE?" },
      { type: TYPES.word, value: "SET-WORD!" },
    ],
  },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "setword" },
      { type: TYPES.word, value: "NEEDS_BINDING" },
      { type: TYPES.word, value: "true" },
    ],
  },
);

// =============================================================================
// Example Program to Evaluate
// =============================================================================

console.log("Creating example program in the graph...\n");

// Simulate parsed program structure
// Program: x: 10  y: 20  print add x y

// Add x: 10
runtime.builtins.fact({}, { type: TYPES.word, value: "prog" }, {
  type: TYPES.number,
  value: 0,
}, { type: TYPES.word, value: "x-setword" });

runtime.builtins.fact({}, { type: TYPES.word, value: "x-setword" }, {
  type: TYPES.word,
  value: "TYPE?",
}, { type: TYPES.word, value: "SET-WORD!" });

runtime.builtins.fact({}, { type: TYPES.word, value: "x-setword" }, {
  type: TYPES.word,
  value: "SPELLING?",
}, { type: TYPES.word, value: "X" });

runtime.builtins.fact({}, { type: TYPES.word, value: "prog" }, {
  type: TYPES.number,
  value: 1,
}, { type: TYPES.number, value: 10 });

// Add y: 20
runtime.builtins.fact({}, { type: TYPES.word, value: "prog" }, {
  type: TYPES.number,
  value: 2,
}, { type: TYPES.word, value: "y-setword" });

runtime.builtins.fact({}, { type: TYPES.word, value: "y-setword" }, {
  type: TYPES.word,
  value: "TYPE?",
}, { type: TYPES.word, value: "SET-WORD!" });

runtime.builtins.fact({}, { type: TYPES.word, value: "y-setword" }, {
  type: TYPES.word,
  value: "SPELLING?",
}, { type: TYPES.word, value: "Y" });

runtime.builtins.fact({}, { type: TYPES.word, value: "prog" }, {
  type: TYPES.number,
  value: 3,
}, { type: TYPES.number, value: 20 });

// Add print word
runtime.builtins.fact({}, { type: TYPES.word, value: "prog" }, {
  type: TYPES.number,
  value: 4,
}, { type: TYPES.word, value: "print-word" });

runtime.builtins.fact({}, { type: TYPES.word, value: "print-word" }, {
  type: TYPES.word,
  value: "TYPE?",
}, { type: TYPES.word, value: "WORD!" });

runtime.builtins.fact({}, { type: TYPES.word, value: "print-word" }, {
  type: TYPES.word,
  value: "SPELLING?",
}, { type: TYPES.word, value: "PRINT" });

// =============================================================================
// Query and Display Results
// =============================================================================

console.log("Querying the evaluation state...\n");

// Find all setwords that need binding
const needsBinding = runtime.builtins.query({}, {
  type: TYPES.block,
  value: [
    { type: TYPES.getWord, value: "word" },
    { type: TYPES.word, value: "NEEDS_BINDING" },
    { type: TYPES.word, value: "true" },
  ],
});

console.log("Setwords needing binding:", needsBinding);

// Find all words marked for evaluation
const needsEval = runtime.builtins.query({}, {
  type: TYPES.block,
  value: [
    { type: TYPES.getWord, value: "word" },
    { type: TYPES.word, value: "NEEDS_EVAL" },
    { type: TYPES.word, value: "true" },
  ],
});

console.log("Words needing evaluation:", needsEval);

// Check if PRINT was detected
const printWords = runtime.builtins.query({}, {
  type: TYPES.block,
  value: [
    { type: TYPES.getWord, value: "word" },
    { type: TYPES.word, value: "SPELLING?" },
    { type: TYPES.word, value: "PRINT" },
  ],
});

console.log("PRINT words found:", printWords);

// =============================================================================
// Cascading Evaluation Rules
// =============================================================================

console.log("\n=== Setting up cascading evaluation ===\n");

// When a setword needs binding, bind it to the next value
runtime.builtins.rule(
  {},
  { type: TYPES.word, value: "bind-setword" },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "block" },
      { type: TYPES.getWord, value: "index" },
      { type: TYPES.getWord, value: "setword" },
    ],
  },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.word, value: "BINDING" },
      { type: TYPES.getWord, value: "setword" },
      { type: TYPES.word, value: "PENDING" },
    ],
  },
);

// Evaluation cascade example
runtime.builtins.watch(
  {},
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "word" },
      { type: TYPES.word, value: "NEEDS_EVAL" },
      { type: TYPES.word, value: "true" },
    ],
  },
  {
    type: TYPES.block,
    value: [
      // This would contain evaluation logic
      { type: TYPES.word, value: "EVALUATED" },
    ],
  },
);

// =============================================================================
// Show Final Graph State
// =============================================================================

console.log("\n=== Final Graph State ===\n");

const graphInfo = runtime.builtins["graph-info"]({});
console.log("Graph statistics:", graphInfo);

// Show some edges
console.log("\nSample edges:");
const edges = g.edges.slice(0, 10);
edges.forEach((edge) => {
  console.log(`  ${edge.source} --[${edge.attr}]--> ${edge.target}`);
});

console.log("\n=== Pattern-Based Semantic Evaluation Complete ===\n");
console.log("This example demonstrates how to:");
console.log("1. Define semantic rules as patterns");
console.log("2. Represent program structure in the graph");
console.log("3. Use pattern matching for evaluation");
console.log("4. Create cascading evaluation through reactive patterns");
console.log("\nThe graph now contains the program representation and");
console.log("evaluation markers added by the pattern rules.");

// =============================================================================
// Advanced: Meta-circular evaluation
// =============================================================================

console.log("\n=== Meta-circular Pattern ===\n");

// Pattern that creates patterns!
runtime.builtins.fact({}, { type: TYPES.word, value: "pattern-def-1" }, {
  type: TYPES.word,
  value: "TYPE",
}, { type: TYPES.word, value: "PATTERN_DEF" });

runtime.builtins.fact({}, { type: TYPES.word, value: "pattern-def-1" }, {
  type: TYPES.word,
  value: "SPEC",
}, { type: TYPES.string, value: JSON.stringify([["?x", "ACTIVE", "true"]]) });

// Watch for pattern definitions and create them
runtime.builtins.watch(
  {},
  {
    type: TYPES.block,
    value: [
      { type: TYPES.getWord, value: "def" },
      { type: TYPES.word, value: "TYPE" },
      { type: TYPES.word, value: "PATTERN_DEF" },
    ],
  },
  {
    type: TYPES.block,
    value: [
      { type: TYPES.word, value: "META_PATTERN_CREATED" },
    ],
  },
);

console.log(
  "Meta-circular pattern defined - patterns can now create patterns!",
);

export { g, runtime };
