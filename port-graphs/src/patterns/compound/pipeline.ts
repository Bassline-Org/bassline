import { Gadget, createGadget } from "../../core";
import { withTaps, type Tappable } from "../../semantics/tapping";
import { noop } from "../../effects";

/**
 * Creates a pipeline of gadgets where each gadget's effects flow to the next
 *
 * Uses tapping to connect gadgets without modifying their core behavior.
 * The pipeline itself is a gadget that forwards data to the first stage.
 */
export function pipeline<State = any, Incoming = any, Effect = any>(
  ...stages: Tappable[]
): Gadget<{ stages: Tappable[] }, Incoming, Effect> {
  // Make all stages tappable
  const tappableStages = stages.map(withTaps);

  // Wire each stage to the next
  const cleanups: Array<() => void> = [];
  for (let i = 0; i < tappableStages.length - 1; i++) {
    const cleanup = tappableStages[i]!.tap((effect) => {
      // Extract value from standard effect format if present
      const value = effect && typeof effect === 'object' && 'changed' in effect
        ? (effect as any).changed
        : effect;
      tappableStages[i + 1]!.receive(value);
    });
    cleanups.push(cleanup);
  }

  return createGadget<{ stages: Tappable[]; cleanups: Array<() => void> }, Incoming, Effect>(
    (_state, incoming) => ({ action: 'forward', context: incoming }),
    {
      'forward': (gadget, incoming) => {
        const { stages } = gadget.current();

        // Wire last stage to emit through the pipeline
        const lastStage = stages[stages.length - 1];
        lastStage.tap((effect) => gadget.emit(effect as Effect));

        // Start the pipeline
        stages[0].receive(incoming);

        return noop();
      }
    }
  )({ stages: tappableStages, cleanups });
}

/**
 * Creates a broadcast gadget that sends effects to multiple targets
 */
export function broadcast<State = any, Incoming = any, Effect = any>(
  source: Gadget<State, Incoming, Effect>,
  targets: Gadget[]
): Tappable<State, Incoming, Effect> {
  const tappableSource = withTaps(source);

  // Wire source to all targets
  targets.forEach(target => {
    tappableSource.tap((effect) => {
      const value = effect && typeof effect === 'object' && 'changed' in effect
        ? (effect as any).changed
        : effect;
      target.receive(value);
    });
  });

  return tappableSource;
}

/**
 * Creates a collector that aggregates data from multiple sources
 */
export function collect<Result = any>(
  sources: Array<{ id: string; gadget: Gadget }>,
  combine: (values: Record<string, any>) => Result
): Gadget<Record<string, any>, any, { result: Result }> {
  const collectorGadget = createGadget<Record<string, any>, Record<string, any>>(
    (state, incoming) => {
      // Update internal state with incoming values
      const newState = { ...state, ...incoming };
      const hasAllValues = sources.every(({ id }) => id in newState);
      if (hasAllValues) {
        return { action: 'combine', context: newState };
      }
      return { action: 'accumulate', context: newState };
    },
    {
      'accumulate': (gadget, values) => {
        gadget.update(values);
        return noop();
      },
      'combine': (gadget, values) => {
        const result = combine(values);
        gadget.update(values);
        return { result } as any;
      }
    }
  )({});

  // Make all sources tappable and wire them to the collector
  sources.forEach(({ id, gadget }) => {
    const tappable = withTaps(gadget);
    tappable.tap((effect) => {
      const value = effect && typeof effect === 'object' && 'changed' in effect
        ? (effect as any).changed
        : effect;
      collectorGadget.receive({ [id]: value });
    });
  });

  return collectorGadget;
}