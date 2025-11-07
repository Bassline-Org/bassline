/**
 * useQuery - Reactive graph query hook
 *
 * Watches a pattern language query and re-renders when matches change.
 * Watcher automatically fires immediately with existing matches.
 *
 * @param {string} patternSource - Query body (where/not/produce syntax)
 * @returns {Array<Map>} Array of variable bindings
 *
 * @example
 * const people = useQuery('where { ?person { type person } }');
 *
 * @example
 * const active = useQuery('where { ?id { type todo } } not { ?id { completed true } }');
 *
 * @example
 * const verified = useQuery('where { ?p { age ?a } } produce { ?p verified true }');
 */
import { useEffect, useState } from "react";
import { useRuntime } from "./useRuntime.js";
import { parsePatterns } from "@bassline/parser/parser";
import { resolve } from "@bassline/parser/graph";
import { unwrapQuad } from "@bassline/parser/runtime";
import { Binding } from "@bassline/parser/helpers";

export function useQuery({ where, not, onMatch } = {}) {
  const runtime = useRuntime();
  useEffect(() => {
    const wherePatterns = where ? parsePatterns(where).map(unwrapQuad) : [];
    const notPatterns = not ? parsePatterns(not).map(unwrapQuad) : [];

    const querySpec = notPatterns.length > 0
      ? { patterns: wherePatterns, nac: notPatterns }
      : wherePatterns;

    const callback = (bindings) => {
      console.log("[useQuery] callback", bindings);
      onMatch?.(new Binding(bindings));
    };
    const unwatch = runtime.graph.watch(querySpec, callback);
    return unwatch;
  }, [runtime.graph, where, not]);
}

export function useComputedQuery(initialValue, { where, not, onMatch } = {}) {
  const runtime = useRuntime();
  const [result, setResult] = useState(initialValue);
  useEffect(() => {
    const wherePatterns = where ? parsePatterns(where).map(unwrapQuad) : [];
    const notPatterns = not ? parsePatterns(not).map(unwrapQuad) : [];

    const querySpec = notPatterns.length > 0
      ? { patterns: wherePatterns, nac: notPatterns }
      : wherePatterns;

    const callback = (bindings) => {
      onMatch?.(new Binding(bindings), setResult);
    };
    const unwatch = runtime.graph.watch(querySpec, callback);
    return unwatch;
  }, [runtime.graph, where, not]);
  return result;
}
