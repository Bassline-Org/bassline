/**
 * Compute Operation Installer
 *
 * Modular installer for arithmetic, unary, and comparison operations.
 * Uses data-driven definitions instead of hardcoded switch statements.
 */

import { builtinOperations } from './definitions.js';

/**
 * Parse a value to a number
 */
function parseNum(value) {
  return typeof value === 'number' ? value : parseFloat(value);
}

/**
 * Install compute watchers on a graph
 * @param {Object} graph - Graph instance
 * @param {Object} operations - Operation definitions (defaults to builtinOperations)
 */
export function installCompute(graph, operations = builtinOperations) {
  // Create lookup maps for fast operation dispatch
  const binaryOps = new Map();
  const unaryOps = new Map();
  const comparisonOps = new Map();

  // Register binary operations
  for (const [name, def] of Object.entries(operations.binary)) {
    const opName = name.toUpperCase();
    binaryOps.set(opName, def);
    graph.add(opName, "TYPE", "OPERATION!");
    graph.add(opName, "DOCS", def.doc);
  }

  // Register unary operations
  for (const [name, def] of Object.entries(operations.unary)) {
    const opName = name.toUpperCase();
    unaryOps.set(opName, def);
    graph.add(opName, "TYPE", "OPERATION!");
    graph.add(opName, "DOCS", def.doc);
  }

  // Register comparison operations
  for (const [name, def] of Object.entries(operations.comparison)) {
    const opName = name.toUpperCase();
    comparisonOps.set(opName, def);
    graph.add(opName, "TYPE", "OPERATION!");
    graph.add(opName, "DOCS", def.doc);
  }

  // Mark OPERATION! as a type
  graph.add("OPERATION!", "TYPE", "TYPE!");

  // Mark TYPE! as a type (meta-type, closes the loop)
  graph.add("TYPE!", "TYPE", "TYPE!");

  // Binary arithmetic watcher: [?C OP ?OP] [?C X ?X] [?C Y ?Y]
  graph.watch([
    ["?C", "OP", "?OP"],
    ["?C", "X", "?X"],
    ["?C", "Y", "?Y"]
  ], (bindings) => {
    const computeId = bindings.get("?C");
    const opName = bindings.get("?OP").toString().toUpperCase();
    const x = bindings.get("?X");
    const y = bindings.get("?Y");

    // Lookup operation
    const op = binaryOps.get(opName);
    if (!op) return;

    // Parse numbers
    const xNum = parseNum(x);
    const yNum = parseNum(y);
    if (isNaN(xNum) || isNaN(yNum)) return;

    // Compute result
    const result = op.compute(xNum, yNum);
    if (!isNaN(result)) {
      graph.add(computeId, "RESULT", result);
    }
  });

  // Unary operations watcher: [?C OP ?OP] [?C VALUE ?V]
  graph.watch([
    ["?C", "OP", "?OP"],
    ["?C", "VALUE", "?V"]
  ], (bindings) => {
    const computeId = bindings.get("?C");
    const opName = bindings.get("?OP").toString().toUpperCase();
    const value = bindings.get("?V");

    // Lookup operation
    const op = unaryOps.get(opName);
    if (!op) return;

    // Parse number
    const num = parseNum(value);
    if (isNaN(num)) return;

    // Compute result
    const result = op.compute(num);
    if (!isNaN(result)) {
      graph.add(computeId, "RESULT", result);
    }
  });

  // Comparison watcher: [?C COMPARE ?OP] [?C LEFT ?L] [?C RIGHT ?R]
  graph.watch([
    ["?C", "COMPARE", "?OP"],
    ["?C", "LEFT", "?L"],
    ["?C", "RIGHT", "?R"]
  ], (bindings) => {
    const computeId = bindings.get("?C");
    const opName = bindings.get("?OP").toString().toUpperCase();
    const left = bindings.get("?L");
    const right = bindings.get("?R");

    // Lookup operation
    const op = comparisonOps.get(opName);
    if (!op) return;

    // Parse numbers
    const leftNum = parseNum(left);
    const rightNum = parseNum(right);
    if (isNaN(leftNum) || isNaN(rightNum)) return;

    // Compute result
    const result = op.compute(leftNum, rightNum);
    graph.add(computeId, "RESULT", result);
  });
}
