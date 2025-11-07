/**
 * useQuery - Reactive graph query hook
 *
 * Watches a pattern and re-renders when matches change.
 * Watcher automatically fires immediately with existing matches.
 *
 * @param {Array} patterns - Array of pattern arrays
 * @returns {Array<Map>} Array of variable bindings
 *
 * @example
 * const people = useQuery([["?person", "type", "person", "*"]]);
 */
import { useEffect, useState } from "react";
import { useRuntime } from "./useRuntime.js";

export function useQuery(patterns) {
  const runtime = useRuntime();
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Watch fires immediately with existing matches, then on changes
    const unwatch = runtime.graph.watch(patterns, setResults);
    return unwatch;
  }, [runtime.graph, JSON.stringify(patterns)]);

  return results;
}
