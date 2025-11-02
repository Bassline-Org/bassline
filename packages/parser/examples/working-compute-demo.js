/**
 * Working Compute Demo
 *
 * Demonstrates real computation happening through pattern matching.
 * Compute watchers observe patterns and write results back as edges.
 */

import { Graph } from "../src/minimal-graph.js";
import { parsePattern } from "../src/pattern-parser.js";
import { createContext, executeProgram } from "../src/pattern-words.js";
import { installCompute, getCurrentResultViaQuery } from "../extensions/compute-v2.js";

const graph = new Graph();
const context = createContext(graph);

// Install compute watchers
installCompute(graph);

console.log("=== Working Compute Demo ===\n");

// ============================================================================
// Part 1: Basic Arithmetic
// ============================================================================

console.log("--- Part 1: Basic Arithmetic ---\n");

const arithmeticProgram = `
  ; Simple addition
  fact [compute:add1 { op ADD x 5 y 10 }]

  ; Subtraction
  fact [compute:sub1 { op SUBTRACT x 20 y 8 }]

  ; Multiplication
  fact [compute:mult1 { op MULTIPLY x 6 y 7 }]

  ; Division
  fact [compute:div1 { op DIVIDE x 100 y 4 }]
`;

let ast = parsePattern(arithmeticProgram);
let results = executeProgram(graph, ast, context);

console.log(`Added ${graph.edges.length} edges to graph`);

// Give compute watchers a moment to process
await new Promise((resolve) => setTimeout(resolve, 10));

// Query results
console.log("Arithmetic results:");
const addResult = graph.query(["COMPUTE:ADD1", "RESULT", "?R"]);
if (addResult.length > 0) {
  console.log(`  5 + 10 = ${addResult[0].get("?R")}`);
}

const subResult = graph.query(["COMPUTE:SUB1", "RESULT", "?R"]);
if (subResult.length > 0) {
  console.log(`  20 - 8 = ${subResult[0].get("?R")}`);
}

const multResult = graph.query(["COMPUTE:MULT1", "RESULT", "?R"]);
if (multResult.length > 0) {
  console.log(`  6 * 7 = ${multResult[0].get("?R")}`);
}

const divResult = graph.query(["COMPUTE:DIV1", "RESULT", "?R"]);
if (divResult.length > 0) {
  console.log(`  100 / 4 = ${divResult[0].get("?R")}`);
}

// ============================================================================
// Part 2: Chained Computations
// ============================================================================

console.log("\n--- Part 2: Chained Computations ---\n");

const chainedProgram = `
  ; First computation: 3 + 4
  fact [compute:step1 { op ADD x 3 y 4 }]
`;

ast = parsePattern(chainedProgram);
executeProgram(graph, ast, context);

await new Promise((resolve) => setTimeout(resolve, 10));

// Get first result
const step1Result = graph.query(["COMPUTE:STEP1", "RESULT", "?R"]);
if (step1Result.length > 0) {
  const result1 = step1Result[0].get("?R");
  console.log(`Step 1: 3 + 4 = ${result1}`);

  // Use it in next computation
  const chainProgram2 = `
    ; Second computation: result * 5
    fact [compute:step2 { op MULTIPLY x ${result1} y 5 }]
  `;

  ast = parsePattern(chainProgram2);
  executeProgram(graph, ast, context);

  await new Promise((resolve) => setTimeout(resolve, 10));

  const step2Result = graph.query(["COMPUTE:STEP2", "RESULT", "?R"]);
  if (step2Result.length > 0) {
    const result2 = step2Result[0].get("?R");
    console.log(`Step 2: ${result1} * 5 = ${result2}`);
    console.log(`Chain result: (3 + 4) * 5 = ${result2}`);
  }
}

// ============================================================================
// Part 3: Unary Operations
// ============================================================================

console.log("\n--- Part 3: Unary Operations ---\n");

const unaryProgram = `
  ; Square root
  fact [compute:sqrt1 { op SQRT value 25 }]

  ; Absolute value
  fact [compute:abs1 { op ABS value -42 }]

  ; Rounding
  fact [compute:round1 { op ROUND value 3.7 }]
`;

ast = parsePattern(unaryProgram);
executeProgram(graph, ast, context);

await new Promise((resolve) => setTimeout(resolve, 10));

console.log("Unary operations:");
const sqrtResult = graph.query(["COMPUTE:SQRT1", "RESULT", "?R"]);
if (sqrtResult.length > 0) {
  console.log(`  sqrt(25) = ${sqrtResult[0].get("?R")}`);
}

const absResult = graph.query(["COMPUTE:ABS1", "RESULT", "?R"]);
if (absResult.length > 0) {
  console.log(`  abs(-42) = ${absResult[0].get("?R")}`);
}

const roundResult = graph.query(["COMPUTE:ROUND1", "RESULT", "?R"]);
if (roundResult.length > 0) {
  console.log(`  round(3.7) = ${roundResult[0].get("?R")}`);
}

// ============================================================================
// Part 4: Comparisons
// ============================================================================

console.log("\n--- Part 4: Comparisons ---\n");

const comparisonProgram = `
  ; Greater than
  fact [compute:gt1 { compare GT left 10 right 5 }]

  ; Less than
  fact [compute:lt1 { compare LT left 10 right 5 }]

  ; Equal
  fact [compute:eq1 { compare EQ left 10 right 10 }]
`;

ast = parsePattern(comparisonProgram);
executeProgram(graph, ast, context);

await new Promise((resolve) => setTimeout(resolve, 10));

console.log("Comparison results:");
const gtResult = graph.query(["COMPUTE:GT1", "RESULT", "?R"]);
if (gtResult.length > 0) {
  console.log(`  10 > 5 = ${gtResult[0].get("?R")}`);
}

const ltResult = graph.query(["COMPUTE:LT1", "RESULT", "?R"]);
if (ltResult.length > 0) {
  console.log(`  10 < 5 = ${ltResult[0].get("?R")}`);
}

const eqResult = graph.query(["COMPUTE:EQ1", "RESULT", "?R"]);
if (eqResult.length > 0) {
  console.log(`  10 == 10 = ${eqResult[0].get("?R")}`);
}

// ============================================================================
// Part 5: Aggregations
// ============================================================================

console.log("\n--- Part 5: Aggregations ---\n");

const aggregationProgram = `
  ; Sum aggregation
  fact [
    agg:sum1 {
      aggregate SUM
      item 10
      item 20
      item 30
      item 40
    }
  ]

  ; Average aggregation
  fact [
    agg:avg1 {
      aggregate AVG
      item 5
      item 10
      item 15
      item 20
    }
  ]

  ; Min/Max aggregation
  fact [
    agg:minmax {
      aggregate MIN
      item 42
      item 17
      item 99
      item 3
    }
  ]
`;

ast = parsePattern(aggregationProgram);
executeProgram(graph, ast, context);

await new Promise((resolve) => setTimeout(resolve, 10));

console.log("Aggregation results:");
const sumResult = getCurrentResultViaQuery(graph, "AGG:SUM1");
if (sumResult !== null) {
  console.log(`  sum([10, 20, 30, 40]) = ${sumResult}`);
}

const avgResult = getCurrentResultViaQuery(graph, "AGG:AVG1");
if (avgResult !== null) {
  console.log(`  avg([5, 10, 15, 20]) = ${avgResult}`);
}

const minResult = getCurrentResultViaQuery(graph, "AGG:MINMAX");
if (minResult !== null) {
  console.log(`  min([42, 17, 99, 3]) = ${minResult}`);
}

// ============================================================================
// Part 6: Rule-Driven Computation
// ============================================================================

console.log("\n--- Part 6: Rule-Driven Computation ---\n");

const ruleComputeProgram = `
  ; Rule that triggers computation when it sees values
  rule auto-compute [
    ?entity { needs-sum true value1 ?v1 value2 ?v2 }
  ] -> [
    compute:?entity { op ADD x ?v1 y ?v2 }
  ]

  ; Add some entities that need computation
  fact [
    order1 { needs-sum true value1 100 value2 50 }
    order2 { needs-sum true value1 75 value2 25 }
  ]
`;

ast = parsePattern(ruleComputeProgram);
executeProgram(graph, ast, context);

await new Promise((resolve) => setTimeout(resolve, 20));

console.log("Rule-driven computations:");
const order1Result = graph.query(["COMPUTE:ORDER1", "RESULT", "?R"]);
if (order1Result.length > 0) {
  console.log(`  order1: 100 + 50 = ${order1Result[0].get("?R")}`);
}

const order2Result = graph.query(["COMPUTE:ORDER2", "RESULT", "?R"]);
if (order2Result.length > 0) {
  console.log(`  order2: 75 + 25 = ${order2Result[0].get("?R")}`);
}

// ============================================================================
// Summary
// ============================================================================

console.log("\n=== Summary ===\n");

// Count all compute results
const allResults = graph.query(["?C", "RESULT", "?R"]);
console.log(`Total computations performed: ${allResults.length}`);

// Show all compute nodes
console.log("\nAll compute nodes:");
allResults.forEach((binding) => {
  const compute = binding.get("?C");
  const result = binding.get("?R");
  console.log(`  ${compute} → ${result}`);
});

// Show graph statistics
console.log("\n=== Graph Statistics ===");
console.log(`Total edges: ${graph.edges.length}`);

const computeEdges = graph.edges.filter((e) =>
  e.source.toString().includes("compute:")
);
console.log(`Compute-related edges: ${computeEdges.length}`);

// Cleanup
context.cleanup();
console.log("\n=== Demo Complete ===");
