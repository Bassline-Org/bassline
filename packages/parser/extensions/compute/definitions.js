/**
 * Operation Definitions
 *
 * Data-driven definitions for arithmetic, unary, and comparison operations.
 * Each operation is a pure function with documentation.
 */

export const builtinOperations = {
  binary: {
    ADD: {
      compute: (x, y) => x + y,
      doc: "Binary addition"
    },
    SUBTRACT: {
      compute: (x, y) => x - y,
      doc: "Binary subtraction"
    },
    MULTIPLY: {
      compute: (x, y) => x * y,
      doc: "Binary multiplication"
    },
    DIVIDE: {
      compute: (x, y) => x / y,
      doc: "Binary division"
    },
    MOD: {
      compute: (x, y) => x % y,
      doc: "Modulo operation"
    },
    POW: {
      compute: (x, y) => Math.pow(x, y),
      doc: "Power operation"
    }
  },

  unary: {
    SQRT: {
      compute: (x) => Math.sqrt(x),
      doc: "Square root"
    },
    ABS: {
      compute: (x) => Math.abs(x),
      doc: "Absolute value"
    },
    FLOOR: {
      compute: (x) => Math.floor(x),
      doc: "Floor function"
    },
    CEIL: {
      compute: (x) => Math.ceil(x),
      doc: "Ceiling function"
    },
    ROUND: {
      compute: (x) => Math.round(x),
      doc: "Round to nearest integer"
    },
    NEGATE: {
      compute: (x) => -x,
      doc: "Negate a number"
    }
  },

  comparison: {
    GT: {
      compute: (l, r) => l > r,
      doc: "Greater than"
    },
    LT: {
      compute: (l, r) => l < r,
      doc: "Less than"
    },
    GTE: {
      compute: (l, r) => l >= r,
      doc: "Greater than or equal"
    },
    LTE: {
      compute: (l, r) => l <= r,
      doc: "Less than or equal"
    },
    EQ: {
      compute: (l, r) => l === r,
      doc: "Equal"
    },
    NEQ: {
      compute: (l, r) => l !== r,
      doc: "Not equal"
    }
  }
};
