import _ from "lodash";

/**
 * Creates a gadget from a multimethod dispatch function
 * This makes use of currying for better type inference & less heinous generics
 * The first function binds the consider fn, this is the dispatch function for the body implementaiton, based on the received data
 * This function should return a key into the action map, which is a map from case -> implementation
 * The second function binds the action map, which is used to compute internally, and return an effect
 * The implementation function should have the same params as the dispatch fn, WITH AN ADDED GADGET AS THE FIRST ARGUMENT
 * The third function actually creates an instance of the gadget, with an initial value passed in as the argument
 * @param considerFn
 * @returns (actionMap) => (initial) => Gadget
 * @example
 * // Defining the consideration cases
 * const first = createGadget((current: number, incoming: number) => {
 *   if (current > incoming) return 'merge';
 *   return 'ignore';
 * });
 * // Defining the action map
 * const second = first({
 *   'merge': (gadget, current, incoming) => {
 *     const result = Math.max(current, incoming);
 *     if(result > current) {
 *       gadget.update(result);
 *       return changed(result);
 *     } else {
 *       return noop();
 *     }
 *   },
 *   'ignore': (gadget, current, incoming) => {
 *     return noop();
 *   }
 * });
 * // Creating an instance
 * const gadget = second(10);
 * gadget.receive(20);
 * console.log('gadget: ', gadget.current() == 20);
 */
export function createGadget<T>(considerFn: T) {
  type Consider = typeof considerFn extends (current: infer Current, incoming: infer Incoming) => infer R
    ? {
      current: Current;
      incoming: Incoming;
      action: R extends string | number | symbol ? R : never;
      signature: (current: Current, incoming: Incoming) => Consider['action'];
    }
    : never;
  type Action = Consider['action'];
  type Current = Consider['current'];
  type Incoming = Consider['incoming'];

  const consider = considerFn as Consider['signature'];

  return function <Actions extends Record<Action, (gadget: Gadget<Current, Incoming, any>, current: Current, incoming: Incoming) => any>>(
    actions: Actions
  ) {
    type AllEffects = {
      [K in keyof Actions]: Actions[K] extends (...args: any[]) => infer R ? R : never
    }[keyof Actions];

    const cases = actions as Record<Action, Actions[keyof Actions]>;

    return (initial: Current) => {
      let current = initial;
      const gadget: Gadget<Current, Incoming, AllEffects> = {
        current: () => current,
        update: (data) => {
          current = data;
        },
        receive: (data: Incoming) => {
          const action = consider(current, data);
          const actionFn = cases[action];
          if (actionFn) {
            const effect = actionFn(gadget, current, data);
            gadget.emit(effect);
          }
        },
        // By default emit just logs
        emit: (effect: AllEffects) => { console.log('emit: ', effect); }
      }
      return gadget;
    }
  }
}

export interface Gadget<
  Current extends any = any, Incoming extends any = any, Effect extends any = any> {
  update: (data: Current) => void;
  current: () => Current;
  receive: (data: Incoming) => void;
  emit: (effect: Effect) => void;
}