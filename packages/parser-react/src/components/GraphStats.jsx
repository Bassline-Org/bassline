import { useMemo } from 'react';
import { useQuery } from '../hooks/useQuery.js';
import { pattern, patternQuad as pq } from '@bassline/parser/algebra';
import { variable as v, WC } from '@bassline/parser/types';

/**
 * GraphStats - Display graph statistics and overview
 *
 * Shows key metrics about the graph: total quads, unique entities,
 * unique attributes, and unique contexts.
 *
 * @param {Object} props
 * @param {EventTarget} props.events - EventTarget from instrument(graph)
 *
 * @example
 * ```jsx
 * <GraphStats events={events} />
 * ```
 */
export function GraphStats({ events }) {
    // Query all quads to calculate statistics
    const allPattern = useMemo(() => {
        return pattern(pq(v('s'), v('a'), v('t'), v('c')));
    }, []);

    const matches = useQuery(allPattern, events);

    // Calculate statistics
    const stats = useMemo(() => {
        const entities = new Set();
        const attributes = new Set();
        const contexts = new Set();

        matches.forEach(match => {
            const source = match.get('s');
            const attr = match.get('a');
            const context = match.get('c');

            entities.add(source);
            attributes.add(attr);
            contexts.add(context);
        });

        return {
            totalQuads: matches.length,
            uniqueEntities: entities.size,
            uniqueAttributes: attributes.size,
            uniqueContexts: contexts.size,
        };
    }, [matches]);

    return (
        <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}>
            <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e293b',
            }}>
                Graph Statistics
            </h3>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
            }}>
                {/* Total Quads */}
                <div style={{
                    padding: '16px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                }}>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '8px',
                    }}>
                        Total Quads
                    </div>
                    <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        color: '#1e293b',
                        fontFamily: 'ui-monospace, monospace',
                    }}>
                        {stats.totalQuads}
                    </div>
                </div>

                {/* Unique Entities */}
                <div style={{
                    padding: '16px',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd',
                }}>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#0369a1',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '8px',
                    }}>
                        Entities
                    </div>
                    <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        color: '#0c4a6e',
                        fontFamily: 'ui-monospace, monospace',
                    }}>
                        {stats.uniqueEntities}
                    </div>
                </div>

                {/* Unique Attributes */}
                <div style={{
                    padding: '16px',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                }}>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#15803d',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '8px',
                    }}>
                        Attributes
                    </div>
                    <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        color: '#14532d',
                        fontFamily: 'ui-monospace, monospace',
                    }}>
                        {stats.uniqueAttributes}
                    </div>
                </div>

                {/* Unique Contexts */}
                <div style={{
                    padding: '16px',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    border: '1px solid #fde68a',
                }}>
                    <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#92400e',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '8px',
                    }}>
                        Contexts
                    </div>
                    <div style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        color: '#78350f',
                        fontFamily: 'ui-monospace, monospace',
                    }}>
                        {stats.uniqueContexts}
                    </div>
                </div>
            </div>
        </div>
    );
}
