/**
 * Core type definitions for spec-driven gadgets
 */

// Import effect types from effects module to avoid duplication
import type { ChangedEffect, NoopEffect, ContradictionEffect } from '../effects';

// Core Gadget interface
export interface Gadget<State = unknown, Incoming = unknown, Effect extends GadgetEffects = GadgetEffects> {
  current: () => State;
  update: (state: State) => void;
  receive: (data: Incoming) => void;
  emit: (effect: Effect) => void;
}

// Base types for actions and effects - just objects with named contexts
export type GadgetActions = {
  [key: string]: unknown;
};

export type GadgetEffects = {
  [key: string]: unknown;
};

// The core spec type - defines the complete shape of a gadget
export type PartialSpec<
  State = unknown,
  Input = unknown,
  Effects extends GadgetEffects = GadgetEffects
> = {
  state: State;
  input: Input;
  effects: Effects;
};

export type GadgetSpec<State = unknown, Input = unknown, Actions extends GadgetActions = GadgetActions, Effects extends GadgetEffects = GadgetEffects> = PartialSpec<State, Input, Effects> & {
  actions: Actions;
};

export interface TypedGadget<Spec extends PartialSpec = PartialSpec> extends Gadget<Spec['state'], Spec['input'], Spec['effects']> { }

export type ExtractSpec<G> = G extends Gadget<infer S, infer I, infer E>
  ? PartialSpec<S, I, E>
  : G extends PartialSpec<infer S, infer I, infer E> ?
  PartialSpec<S, I, E>
  : never;

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