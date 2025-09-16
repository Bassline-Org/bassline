/**
 * React hook for integrating gadgets with React state management
 *
 * This hook creates a bridge between the gadget protocol and React's state system,
 * making React's state the single source of truth while preserving gadget behavior.
 */

import { useRef, useState, useCallback } from 'react';
import { changed, createFn, createGadget, noop, replaceSemantics, type Gadget } from 'port-graphs';
import _ from 'lodash';

/**
 * Creates a React-aware gadget that uses React state as its source of truth
 *
 * @param factory - Function that creates a gadget with initial state
 * @param initialState - Initial state for both React and the gadget
 * @returns Tuple of [currentState, send] where send passes data to gadget.receive
 */
type GadgetFactory<State, Incoming = any, Effect = any> = (initial: State) => Gadget<State, Incoming, Effect>;

/**
 * Creates a React-aware gadget by replacing its state management
 * with React state. Must be used inside a React component.
 */
export function useGadget<State, Incoming, Effect>(
  factory: (initial: State) => Gadget<State, Incoming, Effect>,
  initial: State
) {
  const gadgetRef = useRef<Gadget<State, Incoming, Effect>>();
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef<State>(state);

  // Apply the React state semantics once
  if (!gadgetRef.current) {
    const gadget = factory(initial);
    const replaced = replaceSemantics(gadget, {
      emit: gadget.emit,
      current: () => stateRef.current,
      update: (newState) => {
        setState(newState);
        stateRef.current = newState;
      },
    });
    gadgetRef.current = replaced;
    stateRef.current = initial;
  };
  const send = gadgetRef.current!.receive;

  return [state, send, gadgetRef.current!];
}

type PublisherArgs = {
  topics: string[];
  changed: any;
}
export const publisher = createGadget<PublisherArgs, Record<string, any>>(
  (current, incoming) => {
    const changed = incoming['changed'];
    if (changed) {
      return { action: 'publish', context: { topics: current.topics, data: changed } };
    }
    return null;
  },
  {
    'publish': (gadget, { topics, data }) => {
      gadget.update({ topics, changed: data });
      return { publish: { topics, data } };
    }
  });

type PubSubArgs = {
  publish: {
    topics: string[];
    data: any;
  },
  subscribe: {
    topics: string[];
    source: Gadget;
  }
}

type PubSubState = Record<string, Gadget[]>;

export const pubsub = createGadget<PubSubState, Partial<PubSubArgs>>(
  (current, incoming) => {
    const { publish, subscribe } = incoming;
    if (publish) {
      const { topics, data } = publish;
      return { action: 'publish', context: { topics, data } };
    }
    if (subscribe) {
      const { topics, source } = subscribe;
      return { action: 'subscribe', context: { topics, source } };
    }
    return null;
  },
  {
    'publish': (gadget, { topics, data }) => {
      const state = gadget.current();
      topics.forEach((topic: string) => {
        state[topic]?.forEach(gadget => {
          gadget.receive(data);
        });
      })
      return noop();
    },
    'subscribe': (gadget, { topics, source }) => {
      const state = gadget.current();
      topics.forEach((topic: string) => {
        state[topic] = _.union(state[topic] ?? [], [source]);
      })
      gadget.update(state);
      return changed(state);
    }
  }
)