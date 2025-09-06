/**
 * Multi-input gadgets that work with Pool for semantic binding
 * 
 * These gadgets accumulate inputs from multiple semantic sources
 * and fire when all required inputs are present.
 */

import { Gadget } from "./core";
import { assert, Assertion } from "./pool";
import { EventfulGadget } from "./event-gadget";
import { Action } from "./patterns";

/**
 * Tagged value for semantic inputs
 */
export interface TaggedValue<T = unknown> {
  tag: string;
  value: T;
}

/**
 * State for accumulating semantic inputs
 */
export type SemanticState<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] | undefined;
};

/**
 * Creates a gadget that needs multiple semantic inputs
 * 
 * This gadget:
 * 1. Receives tagged values from semantic connections
 * 2. Accumulates them by tag
 * 3. Fires whenever ANY input changes (if all required inputs have values)
 * 4. Optionally resets after firing for continuous operation
 * 
 * @param needs Array of semantic tags this gadget needs
 * @param compute Function to compute output when all inputs are ready
 * @param act Action to perform with computed result
 * @param reset Whether to clear inputs after firing (default: false)
 * @returns Protocol function for the semantic accumulator
 */
export function semanticAccumulator<
  TNeeds extends Record<string, unknown>,
  TOut,
  G extends Gadget<TaggedValue> = Gadget<TaggedValue>
>(
  needs: Array<keyof TNeeds>,
  compute: (inputs: TNeeds) => TOut | null,
  act: Action<TOut, G>,
  reset: boolean = false
): (this: G, data: TaggedValue) => void {
  // Initialize state with all needs as undefined
  const initialState: SemanticState<TNeeds> = {} as SemanticState<TNeeds>;
  for (const need of needs) {
    initialState[need] = undefined;
  }
  
  let state = { ...initialState };
  
  return function(this: G, data: TaggedValue): void {
    const { tag, value } = data;
    
    // Only accumulate if this is a tag we need
    if (!needs.includes(tag as keyof TNeeds)) {
      return;
    }
    
    // Update state with new value
    state[tag as keyof TNeeds] = value as TNeeds[keyof TNeeds];
    
    // Check if all needs are satisfied
    const allSatisfied = needs.every(need => state[need] !== undefined);
    
    if (allSatisfied) {
      // Compute output with current state - fires on EVERY update when all inputs present
      const result = compute(state as TNeeds);
      
      if (result !== null) {
        // Fire action
        act(result, this);
        
        // Reset if configured (rarely wanted for multi-arg functions)
        if (reset) {
          state = { ...initialState };
        }
      }
    }
  };
}

/**
 * A gadget that automatically registers multiple needs with a pool
 * and accumulates semantic inputs
 */
export class MultiNeedsGadget<
  TNeeds extends Record<string, unknown>,
  TOut = unknown
> extends EventfulGadget<TaggedValue> {
  private needTags: Array<keyof TNeeds>;
  private provides?: string;
  
  constructor(
    id: string,
    needs: Array<keyof TNeeds>,
    provides?: string
  ) {
    super(id);
    this.needTags = needs;
    this.provides = provides;
  }
  
  /**
   * Register this gadget's needs with a pool
   */
  registerWith(pool: Gadget<Assertion>): this {
    // Register each need
    for (const tag of this.needTags) {
      pool.receive(assert.needs(this.id, String(tag), this));
    }
    
    // If this gadget also provides something, register that
    if (this.provides) {
      pool.receive(assert.provides(this.id, this.provides, this));
    }
    
    return this;
  }
  
  /**
   * Use a semantic accumulator protocol
   */
  useSemanticCompute(
    compute: (inputs: TNeeds) => TOut | null,
    act: Action<TOut, EventfulGadget<TaggedValue>>,
    reset: boolean = false
  ): this {
    return this.use(
      semanticAccumulator<TNeeds, TOut, EventfulGadget<TaggedValue>>(
        this.needTags,
        compute,
        act,
        reset
      )
    );
  }
}

/**
 * Helper to create a multi-needs gadget with a computation
 */
export function multiNeedsGadget<
  TNeeds extends Record<string, unknown>,
  TOut
>(
  id: string,
  needs: Array<keyof TNeeds>,
  compute: (inputs: TNeeds) => TOut | null,
  act: Action<TOut, EventfulGadget<TaggedValue>>,
  options?: {
    provides?: string;
    reset?: boolean;
  }
): MultiNeedsGadget<TNeeds, TOut> {
  const gadget = new MultiNeedsGadget<TNeeds, TOut>(
    id,
    needs,
    options?.provides
  );
  
  gadget.useSemanticCompute(compute, act, options?.reset);
  
  return gadget;
}

/**
 * Create a simple binary operator gadget
 */
export function binaryOp<T, TOut>(
  id: string,
  leftTag: string,
  rightTag: string,
  op: (left: T, right: T) => TOut,
  act: Action<TOut, EventfulGadget<TaggedValue>>,
  options?: {
    provides?: string;
    reset?: boolean;
  }
): MultiNeedsGadget<Record<string, T>, TOut> {
  type Inputs = Record<string, T>;
  
  return multiNeedsGadget<Inputs, TOut>(
    id,
    [leftTag, rightTag],
    (inputs) => op(inputs[leftTag], inputs[rightTag]),
    act,
    options
  );
}