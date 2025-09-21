/**
 * Core type definitions for spec-driven gadgets
 */

import { Gadget } from '../core';
// Import effect types from effects module to avoid duplication
import type { ChangedEffect, NoopEffect, ContradictionEffect } from '../effects';

// Base types for actions and effects - just objects with named contexts
export type GadgetActions = {
  [key: string]: unknown;
};

export type GadgetEffects = {
  [key: string]: unknown;
};

// The core spec type - defines the complete shape of a gadget
export type GadgetSpec<
  State = unknown,
  Input = unknown,
  Actions extends GadgetActions = GadgetActions,
  Effects extends GadgetEffects = GadgetEffects
> = {
  state: State;
  input: Input;
  actions: Actions;
  effects: Effects;
};

export type TypedGadget<Spec extends GadgetSpec = GadgetSpec> = Gadget<Spec['state'], Spec['input'], Spec['effects']>;

// Additional effect types
export type ErrorEffect<E = string> = { error: E };

// Combine common effects
export type StandardEffects<T = unknown> =
  | ChangedEffect<T>
  | NoopEffect
  | ErrorEffect
  | ContradictionEffect;

// Common action patterns
export type UpdateAction<T = unknown> = { action: 'update'; context: T };
export type IgnoreAction = { action: 'ignore' };
export type ResetAction<T = unknown> = { action: 'reset'; context?: T };

// Standard action sets
export type BasicActions<T = unknown> =
  | UpdateAction<T>
  | IgnoreAction;

export type StandardActions<T = unknown> =
  | UpdateAction<T>
  | IgnoreAction
  | ResetAction<T>;