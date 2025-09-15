import { createGadget } from '../core';

export * as cells from './cells';
export * as functions from './functions';

// A constant gadget that never changes
export const constant = <T>(value: T) => {
  return createGadget<T, any>(
    (_current, _incoming) => null, // Always ignore incoming data
    {} // No actions needed
  )(value);
};