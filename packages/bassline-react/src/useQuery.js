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
import { parseQueryBody } from "@bassline/parser/parser";
import { resolve } from "@bassline/parser/graph";
import { unwrapQuad } from "@bassline/parser/runtime";
import { Binding } from "@bassline/parser/helpers";

export function useQuery(patternSource) {
  const runtime = useRuntime();
  const [results, setResults] = useState([]);

  useEffect(() => {
    const { where, not, produce } = parseQueryBody(patternSource);

    const unwrappedWhere = where.map(unwrapQuad);
    const unwrappedNot = not.map(unwrapQuad);
    const unwrappedProduce = produce.map(unwrapQuad);

    const querySpec = unwrappedNot.length > 0
      ? { patterns: unwrappedWhere, nac: unwrappedNot }
      : unwrappedWhere;

    const callback = (bindings) => {
      // If there's a produce clause, insert quads with substituted variables
      if (unwrappedProduce.length > 0) {
        unwrappedProduce.forEach(([s, a, t, c]) => {
          const source = resolve(s, bindings);
          const attr = resolve(a, bindings);
          const target = resolve(t, bindings);
          const context = resolve(c, bindings);
          runtime.graph.add(source, attr, target, context);
        });
      }
      setResults((prev) => [...prev, new Binding(bindings)]);
    };
    const unwatch = runtime.graph.watch(querySpec, callback);
    return () => {
      console.log("unwatching");
      unwatch();
    };
  }, [runtime.graph, patternSource]);

  return results;
}
