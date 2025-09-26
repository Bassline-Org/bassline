// ============================================
// Type-Level Building Blocks
// ============================================

export type SpecOf<T> = T extends { _spec?: infer Spec } ? Spec : never;
export type State<S> = { state: S };
export type Input<I> = { input: I };
export type Actions<A> = { actions: A };
export type Effects<E> = { effects: E };

export type StateOf<S> = S extends State<infer S> ? S : never;
export type InputOf<I> = I extends Input<infer I> ? I : never;
export type EffectsOf<E> = E extends Effects<infer E> ? E : never;
export type ActionsOf<A> = A extends Actions<infer A> ? A : never;

// ============================================
// Core Gadget Interface
// ============================================

export type Gadget<Spec = unknown> = {
  current: () => StateOf<Spec>;
  update: (state: StateOf<Spec>) => void;
  receive: (data: InputOf<Spec>) => void;
  emit: (effect: Partial<EffectsOf<Spec>>) => void;
  _spec?: Spec;
}

// ============================================
// Dispatch & Method Types
// ============================================

// Extract just the action names from a spec
export type ActionNames<Spec> = keyof ActionsOf<Spec>;

// The dispatch function returns action + context
export type DispatchResult<Spec> = { [K in ActionNames<Spec>]: { [P in K]: ActionsOf<Spec>[K] } }[keyof ActionsOf<Spec>];

// Method signature for a specific action
export type Method<Spec, Action extends ActionNames<Spec>> = (gadget: Gadget<Spec>, context: ActionsOf<Spec>[Action]) => Partial<EffectsOf<Spec>>;

// All methods for a spec
export type Methods<Spec> = { [K in keyof ActionsOf<Spec>]: Method<Spec, K> }

// ============================================
// Implementation Function
// ============================================

export function defGadget<Spec>(
  config: {
    dispatch: (
      state: StateOf<Spec>,
      input: InputOf<Spec>
    ) => DispatchResult<Spec> | null;
    methods: Methods<Spec>;
  }
): (initial: StateOf<Spec>) => Gadget<Spec> {

  return (initial: StateOf<Spec>) => {
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
          const actionName = Object.keys(result)[0] as ActionNames<Spec>;
          const context = result[actionName];

          const method = config.methods[actionName];
          if (method) {
            const effect = method(gadget, context);
            if (effect) {
              gadget.emit(effect);
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
  merge: (gadget: Gadget<Spec>, value: StateOf<Spec>) => { changed: StateOf<Spec> };
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

// ============================================
// Partial Specs & Mixins
// ============================================
export type TapFn<Spec> = (effect: Partial<EffectsOf<Spec>>) => void;
// Tappable only cares about effects
export type Tappable<Spec> = {
  tap: (fn: TapFn<Spec>) => () => void;
}

export function isTappable<Spec>(
  gadget: Gadget<Spec>
): gadget is Gadget<Spec> & Tappable<Spec> {
  return 'tap' in gadget && typeof gadget.tap === 'function';
}

export function withTaps<Spec>(
  gadget: Gadget<Spec>
): Gadget<Spec> & Tappable<Spec> {

  const taps = new Set<TapFn<Spec>>();
  const originalEmit = gadget.emit;
  if (isTappable(gadget)) return gadget;

  gadget.emit = (effect) => {
    originalEmit(effect);
    taps.forEach(fn => fn(effect));
  };

  return Object.assign(gadget, {
    tap: (fn: TapFn<Spec>) => {
      taps.add(fn);
      return () => { taps.delete(fn); };
    }
  })
}

export type Derivable<TState> =
  & State<TState>
  & Effects<{ changed: TState }>;

export const derive = <S extends Effects<{ changed: StateOf<S> }>, Transformed>(
  source: Gadget<S> & Tappable<S>,
  transform: (state: StateOf<S>) => Transformed
) => {
  type DerivedSpec =
    & State<Transformed>
    & Input<StateOf<S>>
    & Actions<{ update: StateOf<S> }>
    & Effects<{ changed: Transformed }>

  const derived = defGadget<DerivedSpec>({
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

export type Contradicts<Spec> = Spec & {
  actions: {
    contradiction: {
      current: Spec extends State<infer S> ? S : never;
      incoming: Spec extends State<infer S> ? S : never;
    };
  }
  effects: {
    contradiction: {
      current: Spec extends State<infer S> ? S : never;
      incoming: Spec extends State<infer S> ? S : never;
    };
  };
}