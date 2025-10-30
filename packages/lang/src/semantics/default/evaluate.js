/**
 * Top-level evaluation function for AST nodes.
 * This bridges the parser output to the evaluator.
 */

import { makeState, runUntilDone } from "./state.js";
import { doSemantics } from "./dialect.js";
import { TYPES } from "./datatypes/types.js";
import { Block, Paren } from "./datatypes/core.js";

/**
 * Evaluate a block node using the state machine evaluator.
 * @param {*} node - AST node (should be a Block)
 * @param {*} context - Evaluation context (ContextBase/ContextChain instance)
 * @param {Function} [k] - Optional continuation callback
 * @returns {*} Evaluation result
 */
export function evaluateBlock(node, context, k) {
    if (node.type !== TYPES.block) {
        throw new Error(`evaluateBlock expects a block, got ${node.type}`);
    }
    
    let result;
    let items = node.items || node.value || [];
    
    while (items.length > 0) {
        const state = makeState(items, context, [], doSemantics);
        const evalResult = runUntilDone(state);
        items = evalResult.rest ?? [];
        result = evalResult.value;
    }
    
    if (k) {
        k(result, items);
    }
    return result;
}

/**
 * Evaluate a paren node using the state machine evaluator.
 * @param {*} node - AST node (should be a Paren)
 * @param {*} context - Evaluation context
 * @param {Function} [k] - Optional continuation callback
 * @returns {*} Evaluation result
 */
export function evaluateParen(node, context, k) {
    if (node.type !== TYPES.paren) {
        throw new Error(`evaluateParen expects a paren, got ${node.type}`);
    }
    
    let result;
    let items = node.items || node.value || [];
    
    while (items.length > 0) {
        const state = makeState(items, context, [], doSemantics);
        const evalResult = runUntilDone(state);
        items = evalResult.rest ?? [];
        result = evalResult.value;
    }
    
    if (k) {
        k(result, items);
    }
    return result;
}

/**
 * Compose a block by evaluating paren items and recursively composing nested blocks.
 * This is useful for dynamically generating code.
 * @param {*} block - Block node to compose
 * @param {*} context - Evaluation context
 * @returns {Block} New block with paren items evaluated and blocks composed
 */
export function composeBlock(block, context) {
    if (block.type !== TYPES.block) {
        throw new Error(`composeBlock expects a block, got ${block.type}`);
    }
    
    const result = [];
    const items = block.items || block.value || [];
    
    for (const item of items) {
        if (item instanceof Paren) {
            result.push(evaluateParen(item, context));
        } else if (item instanceof Block) {
            result.push(composeBlock(item, context));
        } else {
            result.push(item);
        }
    }
    
    return new Block(result);
}

/**
 * Top-level evaluation function for AST nodes.
 * @param {*} node - AST node to evaluate
 * @param {*} context - Evaluation context/environment
 * @param {Function} [k] - Optional continuation callback
 * @returns {*} Evaluation result
 * @throws {Error} If node type is invalid
 */
export function evaluate(node, context, k) {
    if (node.type === TYPES.block) {
        return evaluateBlock(node, context, k);
    }
    if (node.type === TYPES.paren) {
        return evaluateParen(node, context, k);
    }
    throw new Error(`Cannot evaluate node type: ${node.type}`);
}

