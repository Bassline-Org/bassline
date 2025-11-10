import { useEntity } from '../hooks/useEntity.js';
import { serialize } from '@bassline/parser/types';

/**
 * EntityCard - Display all attributes of a single entity
 *
 * Graph-native component that shows all quads where the entity is the source.
 * Uses useEntity hook for reactive updates.
 *
 * @param {Object} props
 * @param {string} props.entityId - The entity to display
 * @param {EventTarget} props.events - EventTarget from instrument(graph)
 * @param {Function} [props.onInspect] - Callback when clicking a value to inspect it
 * @param {boolean} [props.editable=false] - Whether to allow inline editing (future)
 *
 * @example
 * ```jsx
 * <EntityCard
 *   entityId="alice"
 *   events={events}
 *   onInspect={(entity) => console.log('Inspect:', entity)}
 * />
 * ```
 */
export function EntityCard({ entityId, events, onInspect, editable = false }) {
    const matches = useEntity(entityId, events);

    return (
        <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}>
            <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e293b',
                fontFamily: 'ui-monospace, monospace',
            }}>
                {serialize(entityId)}
            </h3>

            {matches.length === 0 ? (
                <div style={{
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontStyle: 'italic',
                }}>
                    No attributes
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {matches.map((match, i) => {
                        const attr = match.get('attr');
                        const value = match.get('value');

                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: '8px',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                }}
                            >
                                <span style={{
                                    fontWeight: '500',
                                    color: '#475569',
                                    fontFamily: 'ui-monospace, monospace',
                                    fontSize: '13px',
                                    minWidth: '80px',
                                }}>
                                    {serialize(attr)}
                                </span>
                                <span style={{ color: '#cbd5e1' }}>:</span>
                                <span
                                    onClick={() => onInspect && onInspect(value)}
                                    style={{
                                        flex: 1,
                                        color: '#1e293b',
                                        fontFamily: 'ui-monospace, monospace',
                                        fontSize: '13px',
                                        cursor: onInspect ? 'pointer' : 'default',
                                        textDecoration: onInspect ? 'underline' : 'none',
                                        textDecorationStyle: 'dotted',
                                    }}
                                    title={onInspect ? 'Click to inspect' : ''}
                                >
                                    {serialize(value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
