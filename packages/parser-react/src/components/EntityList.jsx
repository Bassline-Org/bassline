import { useMemo } from 'react';
import { useQuery } from '../hooks/useQuery.js';
import { pattern, patternQuad as pq } from '@bassline/parser/algebra';
import { variable as v, word as w, WC } from '@bassline/parser/types';
import { serialize } from '@bassline/parser/types';

/**
 * EntityList - Browse and filter entities in the graph
 *
 * Shows a list of all unique entities (sources) in the graph with filtering.
 * Click an entity to select/inspect it.
 *
 * @param {Object} props
 * @param {EventTarget} props.events - EventTarget from instrument(graph)
 * @param {Function} [props.onSelect] - Callback when clicking an entity
 * @param {Function} [props.filter] - Optional filter function (entity) => boolean
 * @param {string} [props.searchTerm] - Optional search term to filter entities
 *
 * @example
 * ```jsx
 * <EntityList
 *   events={events}
 *   onSelect={(entity) => console.log('Selected:', entity)}
 *   searchTerm="alice"
 * />
 * ```
 */
export function EntityList({ events, onSelect, filter, searchTerm = '' }) {
    // Query all entities (sources in quads)
    const entityPattern = useMemo(() => {
        return pattern(pq(v('entity'), v('attr'), v('value'), WC));
    }, []);

    const matches = useQuery(entityPattern, events);

    // Extract unique entities and apply filters
    const entities = useMemo(() => {
        const entitySet = new Set();

        matches.forEach(match => {
            const entity = match.get('entity');
            entitySet.add(entity);
        });

        let entityArray = Array.from(entitySet);

        // Apply search filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            entityArray = entityArray.filter(entity => {
                const serialized = serialize(entity).toLowerCase();
                return serialized.includes(searchLower);
            });
        }

        // Apply custom filter
        if (filter) {
            entityArray = entityArray.filter(filter);
        }

        // Sort by serialized form
        entityArray.sort((a, b) => {
            return serialize(a).localeCompare(serialize(b));
        });

        return entityArray;
    }, [matches, searchTerm, filter]);

    if (entities.length === 0) {
        return (
            <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                color: '#94a3b8',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                fontSize: '14px',
            }}>
                {searchTerm ? 'No matching entities' : 'No entities found'}
            </div>
        );
    }

    return (
        <div style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                background: '#f8fafc',
                borderBottom: '2px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <span style={{
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#475569',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                }}>
                    Entities
                </span>
                <span style={{
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: '500',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                }}>
                    {entities.length}
                </span>
            </div>

            {/* Entity list */}
            <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
            }}>
                {entities.map((entity, index) => (
                    <div
                        key={index}
                        onClick={() => onSelect && onSelect(entity)}
                        style={{
                            padding: '12px 16px',
                            borderBottom: index < entities.length - 1 ? '1px solid #f1f5f9' : 'none',
                            cursor: onSelect ? 'pointer' : 'default',
                            transition: 'background 0.15s',
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '13px',
                            color: '#1e293b',
                        }}
                        onMouseEnter={(e) => {
                            if (onSelect) {
                                e.currentTarget.style.background = '#f8fafc';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                        }}
                    >
                        {serialize(entity)}
                    </div>
                ))}
            </div>
        </div>
    );
}
