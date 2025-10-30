// Type definitions for @bassline/lang/runtime

import type { Value, ContextChain } from "./semantics/default/index.js";

/**
 * Runtime interface for executing Bassline code
 */
export interface Runtime {
  /**
   * Evaluate a value in the runtime's context
   * @param value The value to evaluate
   * @param context Optional context to use (defaults to runtime context)
   * @returns The result of evaluation
   */
  evaluate(value: Value, context?: ContextChain): Value;

  /**
   * Parse a string of Bassline code
   * @param code The code to parse
   * @returns The parsed value
   */
  parse(code: string): Value;

  /**
   * The runtime's global context
   */
  context: ContextChain;
}

/**
 * Create a new runtime instance with default semantics loaded
 * @returns A new runtime instance
 */
export declare function createRuntime(): Runtime;