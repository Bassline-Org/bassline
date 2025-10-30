import { TYPES } from "./datatypes/types.js";
import { Num, Str, Block, Bool } from "./datatypes/core.js";

/**
 * Polymorphic dispatch table for operations.
 * Similar to dialects, but dispatches based on operand types.
 * 
 * @typedef {Object<string, Object<string, Function>>} PolymorphicDispatch
 */

/**
 * Dispatch a polymorphic operation based on operand types.
 * @param {string} operation - Operation name (e.g., '+', '*', 'eq?')
 * @param {*} left - Left operand (Value instance)
 * @param {*} right - Right operand (Value instance)
 * @returns {*} Result of the operation
 * @throws {Error} If operation/type combination not supported
 */
export function dispatchPolymorphic(operation, left, right) {
    const dispatchTable = polymorphicDispatch[operation];
    if (!dispatchTable) {
        throw new Error(`Unknown polymorphic operation: ${operation}`);
    }

    const leftType = left.type;
    const rightType = right.type;

    // Try exact type match first
    const handler = dispatchTable[leftType]?.[rightType];
    if (handler) {
        return handler(left, right);
    }

    // Try single-type handlers (monomorphic)
    const monoHandler = dispatchTable[leftType];
    if (monoHandler && typeof monoHandler === 'function') {
        return monoHandler(left, right);
    }

    // Try with type conversion
    // For now, throw error - we can add conversion logic later
    throw new Error(
        `No handler for ${operation} with types ${leftType} and ${rightType}`
    );
}

/**
 * Polymorphic dispatch table.
 * Each operation maps to a table of type combinations.
 */
export const polymorphicDispatch = {
    '+': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.add(b),
        },
        [TYPES.string]: {
            [TYPES.string]: (a, b) => a.concat(b),
        },
        [TYPES.block]: {
            [TYPES.block]: (a, b) => a.concat(b),
        },
    },

    '-': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.subtract(b),
        },
    },

    '*': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.multiply(b),
        },
    },

    '/': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.divide(b),
        },
    },

    '//': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.modulo(b),
        },
    },

    '>': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.gt(b),
        },
    },

    '<': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.lt(b),
        },
    },

    '>=': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.gte(b),
        },
    },

    '<=': {
        [TYPES.number]: {
            [TYPES.number]: (a, b) => a.lte(b),
        },
    },

    'eq?': {
        // eq? works on any type through Value.equals()
        default: (a, b) => a.equals(b),
    },
};

