/**
 * Built-in IO Compute Operations
 *
 * Standard compute operations using the IO contexts pattern.
 * All operations follow the same interface:
 *   compute: (operands...) => result
 *
 * Usage:
 *   // Binary operation
 *   graph.add("calc1", "X", 10, null);
 *   graph.add("calc1", "Y", 20, null);
 *   graph.add("calc1", "handle", "ADD", "input");
 *   // Result: graph.query(["calc1", "RESULT", "?r", "output"]) => 30
 *
 *   // Unary operation
 *   graph.add("calc2", "VALUE", 16, null);
 *   graph.add("calc2", "handle", "SQRT", "input");
 *   // Result: graph.query(["calc2", "RESULT", "?r", "output"]) => 4
 *
 *   // Comparison operation
 *   graph.add("comp1", "LEFT", 5, null);
 *   graph.add("comp1", "RIGHT", 3, null);
 *   graph.add("comp1", "handle", "GT", "input");
 *   // Result: graph.query(["comp1", "RESULT", "?r", "output"]) => true
 */

export const builtinIOOperations = {
  binary: {
    add: {
      compute: (x, y) => x + y,
      arity: "binary",
      operationType: "arithmetic",
      doc: "Binary addition (x + y). Inputs: X, Y",
    },
    subtract: {
      compute: (x, y) => x - y,
      arity: "binary",
      operationType: "arithmetic",
      doc: "Binary subtraction (x - y). Inputs: X, Y",
    },
    multiply: {
      compute: (x, y) => x * y,
      arity: "binary",
      operationType: "arithmetic",
      doc: "Binary multiplication (x * y). Inputs: X, Y",
    },
    divide: {
      compute: (x, y) => x / y,
      arity: "binary",
      operationType: "arithmetic",
      doc: "Binary division (x / y). Inputs: X, Y",
    },
    modulo: {
      compute: (x, y) => x % y,
      arity: "binary",
      operationType: "arithmetic",
      doc: "Modulo operation (x % y). Inputs: X, Y",
    },
    pow: {
      compute: (x, y) => Math.pow(x, y),
      arity: "binary",
      operationType: "arithmetic",
      doc: "Power operation (x ** y). Inputs: X, Y",
    },
  },

  unary: {
    sqrt: {
      compute: (x) => Math.sqrt(x),
      arity: "unary",
      operationType: "arithmetic",
      doc: "Square root. Input: VALUE",
    },
    abs: {
      compute: (x) => Math.abs(x),
      arity: "unary",
      operationType: "arithmetic",
      doc: "Absolute value. Input: VALUE",
    },
    floor: {
      compute: (x) => Math.floor(x),
      arity: "unary",
      operationType: "arithmetic",
      doc: "Floor function (round down). Input: VALUE",
    },
    ceil: {
      compute: (x) => Math.ceil(x),
      arity: "unary",
      operationType: "arithmetic",
      doc: "Ceiling function (round up). Input: VALUE",
    },
    round: {
      compute: (x) => Math.round(x),
      arity: "unary",
      operationType: "arithmetic",
      doc: "Round to nearest integer. Input: VALUE",
    },
    negate: {
      compute: (x) => -x,
      arity: "unary",
      operationType: "arithmetic",
      doc: "Negate a number (-x). Input: VALUE",
    },
  },
};
