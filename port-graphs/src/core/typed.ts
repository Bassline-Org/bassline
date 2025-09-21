/**
 * Type-safe spec-driven gadget creation
 */
import * as _ from 'lodash';
import type { GadgetSpec, TypedGadget, GadgetActions, GadgetEffects } from './types';

/**
 * Creates a gadget with full type safety based on spec
 *
 * @param consider - Function that evaluates state and input, returns action+context
 * @param actions - Object mapping action names to handlers
 * @returns Function that creates a gadget instance with initial state
*/
// Action result type - what consider returns (single-key object)
export type ActionResult<Actions extends GadgetActions> = {
  [K in keyof Actions]: { [P in K]: Actions[K] }
}[keyof Actions];

// Effect result type - what handlers return (partial object, can emit multiple)
export type EffectResult<Effects extends GadgetEffects> = Partial<Effects>;

export function defGadget<
  Spec extends GadgetSpec
>(
  consider: (state: Spec['state'], input: Spec['input']) => ActionResult<Spec['actions']> | null,
  actions: {
    [K in keyof Spec['actions']]: (
      gadget: TypedGadget<Spec>,
      context: Spec['actions'][K]
    ) => EffectResult<Spec['effects']> | null
  }
): (initial: Spec['state']) => TypedGadget<Spec> {

  return (initial: Spec['state']) => {
    let current = initial;

    const gadget: TypedGadget<Spec> = {
      current: () => current,

      update: (state: Spec['state']) => {
        current = state;
      },

      receive: (data: Spec['input']) => {
        const result = consider(gadget.current(), data);

        if (result !== null) {
          const action = _.keys(result)[0] as keyof Spec['actions'];
          const context = result[action];

          const handler = actions[action];

          if (handler) {
            // No cast needed - TypeScript knows the types match!
            const effect = handler(gadget, context);

            if (effect !== null && effect !== undefined) {
              // Emit the partial effects object
              gadget.emit(effect as Spec['effects']);
            }
          }
        }
      },

      emit: (_effect: Spec['effects']) => {
        // Effects go into the void by default
        // Can be overridden with semantics replacement
      },
    };

    return gadget;
  };
}