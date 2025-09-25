// ============================================
// Type-Level Building Blocks
// ============================================

export type State<S> = { state: S };
export type Input<I> = { input: I };
export type Actions<A extends Record<PropertyKey, unknown>> = { actions: A };
export type Effects<E extends Record<PropertyKey, unknown>> = { effects: E };

// ============================================
// Core Gadget Interface
// ============================================

export interface Gadget<Spec> {
  current: () => Spec extends State<infer S> ? S : never;
  update: (state: Spec extends State<infer S> ? S : never) => void;
  receive: (data: Spec extends Input<infer I> ? I : never) => void;
  emit: (effect: Spec extends Effects<infer E> ? Partial<E> : never) => void;
}

// ============================================
// Dispatch & Method Types
// ============================================

// Extract just the action names from a spec
export type ActionNames<Spec> =
  Spec extends Actions<infer A> ? keyof A : never;

// The dispatch function returns action + context
export type DispatchResult<Spec> =
  Spec extends Actions<infer A>
  ? { [K in keyof A]: { [P in K]: A[K] } }[keyof A]
  : never;

// Method signature for a specific action
export type Method<Spec, Action extends ActionNames<Spec>> =
  Spec extends Actions<infer A> & Effects<infer E>
  ? (gadget: Gadget<Spec>, context: A[Action]) => Partial<E>
  : never;

// All methods for a spec
export type Methods<Spec> =
  Spec extends Actions<infer A> & Effects<infer E>
  ? { [K in keyof A]: (gadget: Gadget<Spec>, context: A[K]) => Partial<E> }
  : never;

// ============================================
// Implementation Function
// ============================================

export function implement<Spec>(
  config: {
    dispatch: (
      state: Spec extends State<infer S> ? S : never,
      input: Spec extends Input<infer I> ? I : never
    ) => DispatchResult<Spec> | null;
    methods: Methods<Spec>;
  }
): (initial: Spec extends State<infer S> ? S : never) => Gadget<Spec> {

  return (initial: Spec extends State<infer S> ? S : never) => {
    let current = initial;

    const gadget: Gadget<Spec> = {
      current: () => current,

      update: (state) => {
        current = state;
      },

      receive: (input) => {
        const result = config.dispatch(current, input);

        if (result !== null) {
          // Extract action name and context
          const actionName = Object.keys(result)[0] as keyof typeof config.methods;
          const context = result[actionName as keyof typeof result];

          const method = config.methods[actionName];
          if (method) {
            const effect = method(gadget, context);
            if (effect) {
              gadget.emit(effect as Spec extends Effects<infer E> ? Partial<E> : never);
            }
          }
        }
      },

      emit: (effect) => {
        // Default: effects go into the void
      }
    };

    return gadget;
  }
}

// ============================================
// Standard Method Libraries
// ============================================

export type CellMethods<Spec> = {
  merge: (gadget: Gadget<Spec>, value: Spec extends State<infer S> ? S : never) => { changed: Spec extends State<infer S> ? S : never };
  ignore: (gadget: Gadget<Spec>, context: {}) => { noop: {} };
};

export function cellMethods<Spec>(): CellMethods<Spec> {
  return {
    merge: (gadget, value) => {
      gadget.update(value);
      return { changed: value };
    },
    ignore: () => ({ noop: {} })
  };
}

// ============================================
// Standard Specs via Composition
// ============================================

export type CellSpec<T> =
  & State<T>
  & Input<T>
  & Actions<{
    merge: T;
    ignore: {};
  }>
  & Effects<{
    changed: T;
    noop: {};
  }>;

export const maxCell = implement<CellSpec<number>>({
  dispatch: (state, input) =>
    input > state ? { merge: input } : { ignore: {} },
  methods: cellMethods()
});

export const minCell = implement<CellSpec<number>>({
  dispatch: (state, input) =>
    input < state ? { merge: input } : { ignore: {} },
  methods: cellMethods()
});

// ============================================
// Partial Specs & Mixins
// ============================================

type TapFn<Spec> = (effect: Spec extends Effects<infer E> ? Partial<E> : never) => void;

// Tappable only cares about effects
export type Tappable<Spec> = {
  tap: (fn: TapFn<Spec>) => () => void;
}

type WithTaps<G> = G extends Tappable<any>
  ? G
  : G extends Gadget<infer S>
  ? Gadget<S> & Tappable<S>
  : never;

export function isTappable<Spec>(
  gadget: Gadget<Spec>
): gadget is Gadget<Spec> & Tappable<Spec> {
  return 'tap' in gadget;
}

export function withTaps<S, G extends Gadget<S>>(
  gadget: G
): WithTaps<G> {
  const taps = new Set<TapFn<S>>();
  const originalEmit = gadget.emit;
  if (isTappable(gadget)) {
    return gadget as WithTaps<G>;
  }

  gadget.emit = (effect) => {
    originalEmit(effect);
    taps.forEach(fn => fn(effect));
  };

  return Object.assign(gadget, {
    tap: (fn: TapFn<S>) => {
      taps.add(fn);
      return () => { taps.delete(fn); };
    }
  }) as WithTaps<G>;
}

// Derivable only needs state and changed effect
export type Derivable<S> =
  & State<S>
  & Effects<{ changed: S }>;

export const derive = <S, D>(
  source: Gadget<Derivable<S>> & Tappable<Derivable<S>>,
  transform: (state: S) => D
): Gadget<Derivable<D>> & Tappable<Derivable<D>> => {
  const derived = implement<Derivable<D> & Input<S> & Actions<{ update: S }>>({
    dispatch: (_state, input) => ({ update: input }),
    methods: {
      update: (gadget, value) => {
        const transformed = transform(value);
        gadget.update(transformed);
        return { changed: transformed };
      }
    }
  })(transform(source.current()));

  // Connect source to derived
  source.tap(({ changed }) => {
    if (changed !== undefined) {
      derived.receive(changed);
    }
  });

  return withTaps(derived);
}

// ============================================
// Table Specs via Composition
// ============================================

export type TableSpec<K extends PropertyKey, V> =
  & State<Record<K, V>>
  & Input<Record<K, V | null>>
  & Actions<{
    merge: { added: Record<K, V>; removed: Record<K, V> };
    ignore: {};
  }>
  & Effects<{
    changed: Record<K, V>;
    added: Record<K, V>;
    removed: Record<K, V>;
    noop: {};
  }>;

export function tableMethods<K extends PropertyKey, V>(): Methods<TableSpec<K, V>> {
  return {
    merge: (gadget, { added, removed }) => {
      const current = gadget.current();
      const next = { ...current };

      // Remove keys
      for (const key in removed) {
        delete next[key];
      }

      // Add/update keys
      for (const key in added) {
        next[key] = added[key];
      }

      gadget.update(next);

      return {
        changed: next,
        added,
        removed
      };
    },

    ignore: () => ({ noop: {} })
  };
}