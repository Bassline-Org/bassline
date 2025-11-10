import { useMemo } from 'react';
import { useQuery } from './useQuery.js';
import { pattern, patternQuad as pq } from '@bassline/parser/algebra';
import { variable as v, word as w, isWord } from '@bassline/parser/types';

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
export function useEntity(entityId, events) {
    // Build pattern: entity ?attr ?value *
    // Use symbol description as stable key for memoization
    const entityKey = isWord(entityId) ? entityId.spelling.description : entityId;

    const entityPattern = useMemo(() => {
        const entity = isWord(entityId) ? entityId : w(entityId);
        return pattern(
            pq(entity, v('attr'), v('value'))
        );
    }, [entityKey]);

    return useQuery(entityPattern, events);
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
export function useEntityFull(entityId, events) {
    // Use symbol description as stable key for memoization
    const entityKey = isWord(entityId) ? entityId.spelling.description : entityId;

    // Outgoing: entity ?attr ?value *
    const outgoingPattern = useMemo(() => {
        const entity = isWord(entityId) ? entityId : w(entityId);
        return pattern(
            pq(entity, v('attr'), v('value'))
        );
    }, [entityKey]);

    // Incoming: ?source ?attr entity *
    const incomingPattern = useMemo(() => {
        const entity = isWord(entityId) ? entityId : w(entityId);
        return pattern(
            pq(v('source'), v('attr'), entity)
        );
    }, [entityKey]);

    const outgoing = useQuery(outgoingPattern, events);
    const incoming = useQuery(incomingPattern, events);

    return { outgoing, incoming };
}
