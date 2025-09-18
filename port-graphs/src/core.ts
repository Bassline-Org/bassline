/**
 * Minimal gadget protocol implementation
 * Consider → Act with context passing
 */

export interface Gadget<State = any, Incoming = any, Effect = any> {
  current: () => State;
  update: (state: State) => void;
  receive: (data: Incoming) => void;
  emit: (effect: Effect) => void;
}

export type ConsiderResult<Context = any> = {
  action: string;
  context?: Context;
} | null;

export type Action<State, Incoming, Context, Effect> =
  (gadget: Gadget<State, Incoming, Effect>, context: Context) => Effect | null;

/**
 * Creates a gadget with consider → act protocol
 *
 * @param consider - Evaluates incoming data and returns action + computed context
 * @param actions - Map of action handlers that receive the computed context
 * @returns Function that creates a gadget instance with initial state
 */
export function createGadget<State, Incoming, Effect = any>(
  consider: (current: State, incoming: Incoming) => ConsiderResult,
  actions: Record<string, Action<State, Incoming, any, Effect>>
) {
  return (initial: State): Gadget<State, Incoming, Effect> => {
    let current = initial;

    const gadget: Gadget<State, Incoming, Effect> = {
      current: () => current,
      update: (state) => {
        current = state;
      },
      receive: (data) => {
        const result = consider(gadget.current(), data);
        if (result) {
          const action = actions[result.action];
          if (action) {
            const effect = action(gadget, result.context || {});
            if (effect !== null) {
              gadget.emit(effect);
            }
          }
        }
      },
      emit: (_effect) => {
        // Effects go into the void
      }
    };

    return gadget;
  };
}