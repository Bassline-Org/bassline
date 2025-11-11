import { useMemo, useSyncExternalStore } from "react";
import { useGraph } from "./useGraph.jsx";
import { useState } from "react";
import { useCallback } from "react";
import { useEffect } from "react";

/**
 * Reactive query hook - automatically re-queries when graph changes
 *
 * Subscribes to graph changes via events and re-executes the pattern query
 * whenever new quads are added. Uses useSyncExternalStore for efficient updates.
 *
 * IMPORTANT: Pass a Pattern object created with pattern() and patternQuad() from
 * @bassline/parser/algebra.
 *
 * @param {Pattern} pattern - Pattern object from pattern(...patternQuads)
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @returns {Array<Match>} Array of Match objects (use match.get(varName) to access bindings)
 *
 * @example
 * ```jsx
 * import { useQuery } from '@bassline/parser-react/hooks';
 * import { pattern, patternQuad as pq } from '@bassline/parser/algebra';
 * import { variable as v, word as w } from '@bassline/parser/types';
 *
 * function PeopleList({ events }) {
 *   // Build pattern: ?person age ?age *
 *   const peoplePattern = pattern(
 *     pq(v('person'), w('age'), v('age'))
 *   );
 *
 *   const matches = useQuery(peoplePattern, events);
 *
 *   return (
 *     <ul>
 *       {matches.map((match, i) => (
 *         <li key={i}>
 *           {match.get('person')}: {match.get('age')} years old
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @example
 * ```jsx
 * // With NAC (negative application condition)
 * const activePattern = pattern(
 *   pq(v('person'), w('status'), w('active'))
 * ).setNAC(
 *   pq(v('person'), w('deleted'), w('true'))
 * );
 *
 * const active = useQuery(activePattern, events);
 * ```
 */
export function useQuery(pattern, onMatch = () => {}) {
    const graph = useGraph();
    useEffect(() => {
        const unwatch = graph.watch({
            pattern,
            production: (match) => {
                onMatch(match);
                return [];
            },
        });
        return () => unwatch();
    }, [pattern, graph]);
    return null;
}
