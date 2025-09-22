/**
 * Map cells using the typed pattern approach
 */

import * as _ from 'lodash';
import { defGadget } from '../../core/typed';
import type { CellSpec } from '../specs';

// Helper to clean objects by removing nil values
export const clean = (...objs: Record<string, any>[]) =>
  objs.map(x => _.omitBy(x, _.isNil));

/**
 * First map - keeps first seen values for each key
 * This is ACI because once a key has a value, it never changes
 */
type MapCellState = { [key: string]: unknown };

export type MapCell<State extends MapCellState, Input extends MapCellState> = CellSpec<
  State,
  Input,
  State
>

export const firstMap = <State extends MapCellState, Input extends MapCellState>(initial: State) => {
  return defGadget<MapCell<State, Input>>(
    (state, input) => {
      // Check if we should ignore
      if (!_.isPlainObject(input) || _.isEmpty(input)) {
        return { ignore: {} };
      }

      // Clean and merge - existing values take precedence
      const [cleanedState, cleanedInput] = clean(state, input);
      const result = { ...cleanedInput, ...cleanedState } as State;

      if (_.isEqual(result, state)) {
        return { ignore: {} };
      }

      return { merge: result };
    },
    {
      merge: (gadget, value) => {
        gadget.update(value);
        return { changed: value };
      },
      ignore: () => ({ noop: {} })
    }
  )(initial);
};

/**
 * Last map - keeps last seen values for each key
 * This is ACI because merge is idempotent for same values
 */
export const lastMap = <State extends MapCellState, Input extends MapCellState>(initial: State) => {
  return defGadget<MapCell<State, Input>>(
    (state, input) => {
      // Check if we should ignore
      if (!_.isPlainObject(input) || _.isEmpty(input)) {
        return { ignore: {} };
      }

      // Clean and merge - new values take precedence
      const [cleanedState, cleanedInput] = clean(state, input);
      const result = { ...cleanedState, ...cleanedInput } as State;

      if (_.isEqual(result, state)) {
        return { ignore: {} };
      }

      return { merge: result };
    },
    {
      merge: (gadget, value) => {
        gadget.update({ ...gadget.current(), ...value });
        return { changed: value };
      },
      ignore: () => ({ noop: {} })
    }
  )(initial);
};

/**
 * Union map - unions arrays for each key
 * This is ACI because array union is ACI
 */
export type UnionMapCell<T, State extends { [key: string]: T[] }, Input extends State> = CellSpec<
  State,
  Input,
  State
>;

export const unionMap = <T, State extends { [key: string]: T[] }, Input extends State>(initial: State) => {
  return defGadget<UnionMapCell<T, State, Input>>(
    (state, input) => {
      // Check if we should ignore
      if (!_.isPlainObject(input) || _.isEmpty(input)) {
        return { ignore: {} };
      }

      // Clean and merge with union
      const [cleanedState, cleanedInput] = clean(state, input);
      const result = _.mergeWith(
        cleanedState,
        cleanedInput,
        (a: T[] | undefined, b: T[] | undefined) => {
          if (!a) return b;
          if (!b) return a;
          return _.union(a, b);
        }
      );

      if (_.isEqual(result, state)) {
        return { ignore: {} };
      }

      return { merge: result as typeof state };
    },
    {
      merge: (gadget, value) => {
        gadget.update(value);
        return { changed: value };
      },
      ignore: () => ({ noop: {} })
    }
  )(initial);
};