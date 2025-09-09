/**
 * Semantic routing patterns built on core primitives
 * 
 * These patterns enable semantic discovery and routing
 * using messages and tags, all built with cell and fn.
 * 
 * IMPORTANT: This file now actually uses our existing patterns!
 * - router uses cell to accumulate routes
 * - semanticAccumulator uses cell for state
 * - multiplexer uses actions.direct
 * - bridge/unbridge use fromValue/toValue
 * Everything composes from our basic building blocks.
 */

import { fn, cell, actions, Action } from "./patterns";
import { Gadget } from "./core";
import { Message, fromValue, toValue, filterTag } from "./message";

/**
 * Route table mapping tags to target gadgets
 */
export interface RouteTable {
  [tag: string]: Gadget<Message>[];
}

/**
 * Create a router gadget that forwards messages based on tags
 * Actually uses cell pattern to accumulate routes!
 */
export function router<G extends Gadget<Message | RouteTable> = Gadget<Message | RouteTable>>(
): (this: G, data: Message | RouteTable) => void {
  // Use cell to accumulate route table
  return cell<Message | RouteTable, G>(
    (state, incoming) => {
      // If it's a route table update, merge it
      if (!('tag' in incoming)) {
        return { ...state, ...incoming } as Message | RouteTable;
      }
      
      // If it's a message, route it
      const msg = incoming as Message;
      const routes = state as RouteTable;
      const targets = routes[msg.tag];
      
      if (targets && targets.length > 0) {
        for (const target of targets) {
          target.receive(msg);
        }
      }
      
      return state;
    },
    {} as Message | RouteTable,  // Initial empty route table
    actions.none()  // Routing happens in merge function
  );
}

/**
 * Semantic accumulator that collects messages by tag
 * Now properly using cell to accumulate state!
 */
export function semanticAccumulator<
  TNeeds extends Record<string, unknown>,
  TOut,
  G extends Gadget<Message> = Gadget<Message>
>(
  needs: Array<keyof TNeeds>,
  compute: (inputs: TNeeds) => TOut | null,
  act: Action<TOut, G>,
  options?: {
    reset?: boolean;
    outputTag?: string;
  }
): (this: G, data: Message) => void {
  const initialState: Record<string, unknown> = {};
  for (const need of needs) {
    initialState[String(need)] = undefined;
  }
  
  let state = { ...initialState };
  
  // Use cell for state accumulation
  const stateAccumulator = cell<Message, G>(
    (currentState, msg) => {
      // Only accumulate if we need this tag
      if (!needs.includes(msg.tag as keyof TNeeds)) {
        return currentState;
      }
      
      // Update state
      state[msg.tag] = msg.value;
      return msg;  // Return msg to trigger action
    },
    {} as Message,
    (_, gadget) => {
      // Check if all needs satisfied
      const allSatisfied = needs.every(need => 
        state[String(need)] !== undefined
      );
      
      if (allSatisfied) {
        const result = compute(state as TNeeds);
        if (result !== null) {
          act(result, gadget);
          
          // Reset if configured
          if (options?.reset) {
            state = { ...initialState };
          }
        }
      }
    }
  );
  
  return stateAccumulator;
}

/**
 * Create a splitter that routes messages to different gadgets based on tag
 * This is just fn with a routing action!
 */
export function splitter<G extends Gadget<Message> = Gadget<Message>>(
  routes: RouteTable
): (this: G, data: Message) => void {
  return fn<Message, Message, G>(
    msg => msg,  // Just pass through
    (msg) => {
      // Route to targets for this tag
      const targets = routes[msg.tag];
      if (targets) {
        targets.forEach(t => t.receive(msg));
      }
    }
  );
}

/**
 * Create a multiplexer that combines multiple message streams
 * This is literally just actions.direct!
 */
export function multiplexer<G extends Gadget<Message> = Gadget<Message>>(
  target: Gadget<Message>
): (this: G, data: Message) => void {
  return fn<Message, Message, G>(
    msg => msg,
    actions.direct(target)  // Just use existing action!
  );
}

/**
 * Tag-based conditional routing
 */
export function tagSwitch<G extends Gadget<Message> = Gadget<Message>>(
  cases: { [tag: string]: (value: unknown) => Message | null }
): (this: G, data: Message) => void {
  return fn<Message, Message, G>(
    (msg) => {
      const handler = cases[msg.tag];
      if (handler) {
        return handler(msg.value);
      }
      // Default case - pass through
      return cases['*'] ? cases['*'](msg.value) : msg;
    },
    () => {} // Actions handled by downstream
  );
}

/**
 * Create a semantic bridge between non-message and message gadgets
 * This is just fromValue with a direct action!
 */
export function bridge<T>(
  tag: string,
  target: Gadget<Message<T>>
): Gadget<T> {
  return {
    receive: fromValue<T>(
      tag,
      actions.direct(target)
    ).bind(this)
  };
}

/**
 * Create a reverse bridge from messages to plain values
 * This is just filterTag + toValue chained!
 */
export function unbridge<T>(
  tag: string,
  target: Gadget<T>
): Gadget<Message<T>> {
  // Create a gadget that chains filterTag -> toValue
  const protocol = filterTag<T>(
    tag,
    (msg) => {
      // Extract value and forward to target
      const extractAndForward = toValue<T>(
        actions.direct(target)
      );
      extractAndForward.call(this, msg);
    }
  );
  
  return {
    receive: protocol.bind(this)
  };
}

/**
 * Binary operator that works with messages
 */
export function binaryOp<T, TOut, G extends Gadget<Message> = Gadget<Message>>(
  leftTag: string,
  rightTag: string,
  op: (left: T, right: T) => TOut,
  act: Action<TOut, G>,
  outputTag?: string
): (this: G, data: Message) => void {
  return semanticAccumulator<
    { [K in typeof leftTag | typeof rightTag]: T },
    TOut,
    G
  >(
    [leftTag, rightTag],
    (inputs) => op(inputs[leftTag], inputs[rightTag]),
    act,
    { outputTag }
  );
}