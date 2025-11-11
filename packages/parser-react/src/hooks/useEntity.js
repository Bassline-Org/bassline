import { useMemo, useState } from "react";
import { useQuery } from "./useQuery.js";
import { pattern, patternQuad as pq } from "@bassline/parser/algebra";
import { isWord, variable as v, word as w } from "@bassline/parser/types";

/**
 * Hook for exploring a single entity
 *
 * Returns all quads where the entity appears as the source (subject).
 * Useful for entity detail views and inspectors.
 *
 * @param {string} entityId - The entity to query
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @returns {Array<Match>} Array of Match objects with ?attr and ?value bindings
 *
 * @example
 * ```jsx
 * import { useEntity } from '@bassline/parser-react/hooks';
 *
 * function EntityCard({ entityId, events }) {
 *   const attributes = useEntity(entityId, events);
 *
 *   return (
 *     <div>
 *       <h3>{entityId}</h3>
 *       <ul>
 *         {attributes.map((match, i) => (
 *           <li key={i}>
 *             {match.get('attr')}: {match.get('value')}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useEntity(entityId) {
    const entity = isWord(entityId) ? entityId : w(entityId);
    const [matches, setMatches] = useState([]);
    const entityPattern = useMemo(() => {
        return pattern(
            pq(entity, v("attr"), v("value")),
        );
    }, [entity]);

    useQuery(entityPattern, (match) => {
        setMatches([...matches, match]);
    });

    return matches;
}

/**
 * Hook for querying both outgoing and incoming edges for an entity
 *
 * @param {string} entityId - The entity to query
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @returns {Object} Object with { outgoing, incoming } arrays
 *
 * @example
 * ```jsx
 * function EntityInspector({ entityId, events }) {
 *   const { outgoing, incoming } = useEntityFull(entityId, events);
 *
 *   return (
 *     <div>
 *       <h4>Outgoing ({outgoing.length})</h4>
 *       {outgoing.map((match, i) => (
 *         <div key={i}>
 *           {match.get('attr')}: {match.get('value')}
 *         </div>
 *       ))}
 *
 *       <h4>Incoming ({incoming.length})</h4>
 *       {incoming.map((match, i) => (
 *         <div key={i}>
 *           {match.get('source')} → {match.get('attr')}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useEntityFull(entityId) {
    const entity = isWord(entityId) ? entityId : w(entityId);
    const incomingPattern = useMemo(() =>
        pattern(
            pq(v("source"), v("attr"), entity),
        ), [entity]);
    const outgoingPattern = useMemo(() =>
        pattern(
            pq(entity, v("attr"), v("value")),
        ), [entity]);
    const [outgoing, setOutgoing] = useState([]);
    const [incoming, setIncoming] = useState([]);
    useQuery(
        outgoingPattern,
        (match) => setOutgoing((prev) => [...prev, match]),
    );
    useQuery(
        incomingPattern,
        (match) => setIncoming((prev) => [...prev, match]),
    );

    return { outgoing, incoming };
}
