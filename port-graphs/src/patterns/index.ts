import { createGadget } from '../core';

export * from './specs';
export * as cells from './cells';
export * as functions from './functions';
export * as meta from './meta';
export * as constraints from './constraints';
export * from './family';

// A constant gadget that never changes
export const constant = <T>(value: T) => {
  return createGadget<T, any>(
    (_current, _incoming) => null, // Always ignore incoming data
    {} // No actions needed
  )(value);
};