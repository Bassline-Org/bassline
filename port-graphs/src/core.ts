/**
 * Minimal gadget protocol implementation
 * Consider → Act with context passing
 */

import _ from "lodash";

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

export type GadgetExtension<In extends Gadget = Gadget, Out extends Gadget = In> = (gadget: In) => Out;

export type Callback<T> = T extends (gadget: infer In) => infer Out ? (gadget: In) => Out : never;

let gadgetExtensions: GadgetExtension[] = [];
export const extensions = () => gadgetExtensions;

export function addGadgetExtensions(...extensions: GadgetExtension[]) {
  const union = _.union(gadgetExtensions, extensions);
  gadgetExtensions = union;
  return () => {
    const cleaned = _.difference(gadgetExtensions, extensions);
    gadgetExtensions = cleaned;
  }
}

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
  return <T>(initial: State, callback?: (g: Gadget<State, Incoming, Effect>) => T & Gadget<State, Incoming, Effect>) => {
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
    const extended: Gadget<State, Incoming, Effect> = extensions().reduce((gadget, extension) => extension(gadget), gadget);
    return (callback ? callback(extended) : extended) as T & Gadget<State, Incoming, Effect>;
  };
}