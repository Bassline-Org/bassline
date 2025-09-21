/**
 * Core pattern specifications for different gadget types
 * These define the "shape" of common gadget patterns
 */

import type { GadgetActions, GadgetEffects } from '../core/types';

/**
 * Cell Pattern - Accumulates state monotonically through merge operations
 *
 * The relationship between State and Input is defined by the merge operation.
 * The merge operation must be Associative, Commutative, and Idempotent (ACI).
 *
 * Examples:
 * - MaxCell: State=number, Input=number (merge via max)
 * - UnionCell: State=Set<T>, Input=Set<T> (merge via union)
 * - LastCell: State=T, Input=T (merge via replacement)
 */
export type CellSpec<State, Input, MergeType = Input> = {
  state: State;
  input: Input;
  actions: {
    merge: MergeType;
    ignore: {};
  };
  effects: {
    changed: State;
    noop: {};
  };
};

/**
 * Function Pattern - Computes results from map-based arguments
 *
 * Functions accumulate partial arguments and compute when ready.
 * Natural partial binding through partial maps.
 */
export type FunctionSpec<
  Args extends Record<string, unknown>,
  Result
> = {
  state: Args & { result?: Result };
  input: Partial<Args>;
  actions: {
    compute: Args;
    accumulate: Partial<Args>;
    ignore: {};
  };
  effects: {
    changed: { result: Result; args: Args };
    noop: {};
  };
};

/**
 * Command Pattern - Responds to explicit instructions
 *
 * Base pattern for gadgets that interpret commands rather than merge data.
 * UI controls, state machines, protocol handlers all follow this pattern.
 */
export type CommandSpec<
  State,
  Commands,
  Actions extends GadgetActions = GadgetActions,
  Effects extends GadgetEffects = GadgetEffects
> = {
  state: State;
  input: Commands;
  actions: Actions;
  effects: Effects;
};