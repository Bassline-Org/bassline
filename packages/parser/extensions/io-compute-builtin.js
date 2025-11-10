/**
 * Built-in IO Compute Operations
 *
 * Standard compute operations using the IO contexts pattern.
 * All operations follow the same interface:
 *   compute: (operands...) => result
 *
 * Usage:
 *   // Binary operation
 *   graph.add(q(w("calc1"), w("x"), 10, w("calc1")));
 *   graph.add(q(w("calc1"), w("y"), 20, w("calc1")));
 *   graph.add(q(w("calc1"), w("handle"), w("add"), w("input")));
 *   // Result: getComputeResult(graph, w("calc1")) => 30
 *
 *   // Unary operation
 *   graph.add(q(w("calc2"), w("x"), 16, w("calc2")));
 *   graph.add(q(w("calc2"), w("handle"), w("sqrt"), w("input")));
 *   // Result: getComputeResult(graph, w("calc2")) => 4
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
