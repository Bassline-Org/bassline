// core-typed.ts - Fixed type flow

import _ from 'lodash';

// Gadget with typed inputs and outputs
export class Gadget<TIn = unknown, TOut = unknown> extends EventTarget {
  constructor(
    public readonly id = _.uniqueId('g-'),
    private protocol?: (this: Gadget<TIn, TOut>, data: TIn) => void
  ) {
    super();
  }

  receive(data: TIn): void {
    this.protocol?.call(this, data);
  }

  use(protocol: (this: Gadget<TIn, TOut>, data: TIn) => void): this {
    this.protocol = protocol;
    return this;
  }

  emit<K extends keyof TOut & string>(event: K, data: TOut[K]): void {
    this.dispatchEvent(new CustomEvent(event, { detail: data }));
  }
}

export function protocol<TIn, TApply, TConsider, TOut>(
  apply: (data: TIn) => TApply | null,
  consider: (result: TApply) => TConsider | null,
  act: (result: TConsider, gadget: Gadget<TIn, TOut>) => void
): (this: Gadget<TIn, TOut>, data: TIn) => void {
  return function(this: Gadget<TIn, TOut>, data: TIn) {
    const result = apply(data);
    if (result == null) return;
    
    const decision = consider(result);
    if (decision == null) return;
    
    act(decision, this);
  };
}

// Message types
export type Value<T> = { value: T };

export type Effect<V = unknown> = { effect: V };

export type DefaultEffects = {
    propagate: Effect<any>;
    assert: Effect<any>;
    log: Effect<string>;
}

// Typed cell - specify TOut explicitly
export function cell<T>(
  merge: (old: T, incoming: T) => T,
  initial: T
): (this: Gadget<Value<T>, DefaultEffects>, data: Value<T>) => void {
  let state = initial;
  
  return protocol<Value<T>, { old: T; new: T }, T, DefaultEffects>(
    (data) => {
      const old = state;
      state = merge(old, data.value);
      return { old, new: state };
    },
    (result) => !_.isEqual(result.old, result.new) ? result.new : null,
    (value, gadget) => {
      gadget.emit('propagate', { effect: value });
    }
  );
}

// Typed function - specify TOut explicitly
export function fn<TIn, TOut, TOutEffects extends DefaultEffects>(
  transform: (input: TIn) => TOut | null
): (this: Gadget<Value<TIn>, TOutEffects>, data: Value<TIn>) => void {
  return protocol<Value<TIn>, TOut, TOut, DefaultEffects>(
    (data) => transform(data.value),
    (result) => result,
    (value, gadget) => {
      gadget.emit('propagate', { effect: value });
    }
  );
}

// Builder functions
export const G = {
  cell: <T>(id: string, merge: (a: T, b: T) => T, initial: T) =>
    new Gadget<Value<T>, DefaultEffects>(id).use(cell(merge, initial)),
    
  fn: <TIn, TOut>(id: string, transform: (i: TIn) => TOut | null) =>
    new Gadget<Value<TIn>, DefaultEffects>(id).use(fn(transform)),
    
  // Custom with any output type for flexibility
  custom: <TIn>(id: string) =>
    new Gadget<TIn, any>(id)
};

// Wire helper
export function wire<T>(
  from: Gadget<any, DefaultEffects>,
  to: Gadget<Value<T>, any>
): void {
  from.addEventListener('propagate', (e: Event) => {
    to.receive((e as CustomEvent).detail);
  });
}