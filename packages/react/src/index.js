/**
 * React hooks for Bassline
 *
 * Minimal integration using React 18's useSyncExternalStore
 */

import { useSyncExternalStore, useCallback } from 'react';

/**
 * Subscribe to a mirror's value
 * @param {Bassline} bl - Bassline instance
 * @param {string} ref - Reference URI
 * @returns {*} Current value
 */
export function useRead(bl, ref) {
  const subscribe = useCallback(
    (onStoreChange) => bl.watch(ref, onStoreChange),
    [bl, ref]
  );
  const getSnapshot = useCallback(() => bl.read(ref), [bl, ref]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Get a write function for a mirror
 * @param {Bassline} bl - Bassline instance
 * @param {string} ref - Reference URI
 * @returns {function} Write function
 */
export function useWrite(bl, ref) {
  return useCallback((value) => bl.write(ref, value), [bl, ref]);
}

/**
 * Subscribe to a mirror and get both value and write function
 * @param {Bassline} bl - Bassline instance
 * @param {string} ref - Reference URI
 * @returns {[*, function]} [value, write]
 */
export function useMirror(bl, ref) {
  const value = useRead(bl, ref);
  const write = useWrite(bl, ref);
  return [value, write];
}
