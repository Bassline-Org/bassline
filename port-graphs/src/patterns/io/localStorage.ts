/**
 * LocalStorage gadget - Persists data to browser localStorage
 *
 * A gadget that manages reading and writing to localStorage.
 * Receives data to store, emits loaded data.
 */

import { type State, type Input, type Actions, type Effects, defGadget, withTaps } from '../../core/typed';

export type LocalStorageSpec =
  & State<{
    key: string;
    data: any;
    lastSaved?: number;
    lastLoaded?: number;
  }>
  & Input<
    | { save: any }
    | { load: {} }
    | { clear: {} }
    | { setKey: string }
  >
  & Actions<{
    save: any;
    load: {};
    clear: {};
    setKey: string;
  }>
  & Effects<{
    saved: { key: string; data: any; timestamp: number };
    loaded: { key: string; data: any; timestamp: number };
    cleared: { key: string };
    error: { operation: string; error: string };
    keyChanged: { oldKey: string; newKey: string };
  }>;

export function localStorageGadget(key: string = 'gadget-data') {
  return withTaps(defGadget<LocalStorageSpec>({
    dispatch: (state, input) => {
      if ('save' in input) return { save: input.save };
      if ('load' in input) return { load: input.load };
      if ('clear' in input) return { clear: input.clear };
      if ('setKey' in input) return { setKey: input.setKey };
      return null;
    },

    methods: {
      save: (gadget, data) => {
        const state = gadget.current();
        const timestamp = Date.now();

        try {
          const serialized = JSON.stringify(data);
          localStorage.setItem(state.key, serialized);

          gadget.update({
            ...state,
            data,
            lastSaved: timestamp
          });

          return {
            saved: {
              key: state.key,
              data,
              timestamp
            }
          };
        } catch (error) {
          return {
            error: {
              operation: 'save',
              error: String(error)
            }
          };
        }
      },

      load: (gadget) => {
        const state = gadget.current();
        const timestamp = Date.now();

        try {
          const stored = localStorage.getItem(state.key);
          if (stored === null) {
            return {
              loaded: {
                key: state.key,
                data: null,
                timestamp
              }
            };
          }

          const data = JSON.parse(stored);
          gadget.update({
            ...state,
            data,
            lastLoaded: timestamp
          });

          return {
            loaded: {
              key: state.key,
              data,
              timestamp
            }
          };
        } catch (error) {
          return {
            error: {
              operation: 'load',
              error: String(error)
            }
          };
        }
      },

      clear: (gadget) => {
        const state = gadget.current();

        try {
          localStorage.removeItem(state.key);
          const newState = {
            ...state,
            data: undefined
          };
          delete newState.lastSaved;
          delete newState.lastLoaded;
          gadget.update(newState);

          return { cleared: { key: state.key } };
        } catch (error) {
          return {
            error: {
              operation: 'clear',
              error: String(error)
            }
          };
        }
      },

      setKey: (gadget, newKey) => {
        const state = gadget.current();
        const oldKey = state.key;

        gadget.update({
          ...state,
          key: newKey
        });

        return {
          keyChanged: {
            oldKey,
            newKey
          }
        };
      }
    }
  })({
    key,
    data: undefined
  }));
}