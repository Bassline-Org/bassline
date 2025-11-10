import { useState, useCallback } from 'react';
import { EntityCard } from './EntityCard.jsx';
import { useEntityFull } from '../hooks/useEntity.js';
import { serialize } from '@bassline/parser/types';

/**
 * Inspector - Navigate entity relationships with breadcrumb trail
 *
 * Click on any value to inspect it, building a navigation history.
 * Shows both outgoing and incoming edges for the current entity.
 *
 * @param {Object} props
 * @param {string} [props.initialEntity] - Starting entity to inspect
 * @param {EventTarget} props.events - EventTarget from instrument(graph)
 * @param {Function} [props.onNavigate] - Callback when navigating to new entity
 *
 * @example
 * ```jsx
 * <Inspector
 *   initialEntity="alice"
 *   events={events}
 *   onNavigate={(entity) => console.log('Navigated to:', entity)}
 * />
 * ```
 */
export function Inspector({ initialEntity, events, onNavigate }) {
    const [history, setHistory] = useState(initialEntity ? [initialEntity] : []);
    const currentEntity = history[history.length - 1];

    const { outgoing, incoming } = useEntityFull(currentEntity || '', events);

    // Navigate to a new entity
    const handleInspect = useCallback((value) => {
        setHistory(prev => [...prev, value]);
        onNavigate?.(value);
    }, [onNavigate]);

    // Navigate back in history
    const handleBack = useCallback(() => {
        setHistory(prev => prev.slice(0, -1));
        if (history.length > 1) {
            onNavigate?.(history[history.length - 2]);
        }
    }, [history, onNavigate]);

    // Navigate to specific point in breadcrumb
    const handleBreadcrumb = useCallback((index) => {
        setHistory(prev => prev.slice(0, index + 1));
        onNavigate?.(history[index]);
    }, [history, onNavigate]);

    if (!currentEntity) {
        return (
            <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '48px 24px',
                textAlign: 'center',
                color: '#94a3b8',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                fontSize: '14px',
            }}>
                No entity selected
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}>
            {/* Breadcrumb trail */}
            {history.length > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    overflowX: 'auto',
                }}>
                    {/* Back button */}
                    {history.length > 1 && (
                        <button
                            onClick={handleBack}
                            style={{
                                padding: '6px 12px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                color: '#475569',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                fontFamily: 'ui-monospace, monospace',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e2e8f0';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                        >
                            ← Back
                        </button>
                    )}

                    {/* Breadcrumb trail */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flex: 1,
                    }}>
                        {history.map((entity, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {index > 0 && (
                                    <span style={{ color: '#cbd5e1', fontSize: '14px' }}>→</span>
                                )}
                                <button
                                    onClick={() => handleBreadcrumb(index)}
                                    disabled={index === history.length - 1}
                                    style={{
                                        padding: '6px 12px',
                                        background: index === history.length - 1 ? '#3b82f6' : 'transparent',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: index === history.length - 1 ? 'white' : '#64748b',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        cursor: index === history.length - 1 ? 'default' : 'pointer',
                                        transition: 'all 0.15s',
                                        fontFamily: 'ui-monospace, monospace',
                                        opacity: index === history.length - 1 ? 1 : 0.7,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (index !== history.length - 1) {
                                            e.currentTarget.style.background = '#f1f5f9';
                                            e.currentTarget.style.opacity = 1;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (index !== history.length - 1) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.opacity = 0.7;
                                        }
                                    }}
                                >
                                    {serialize(entity)}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main content: Outgoing and Incoming edges */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '16px',
            }}>
                {/* Outgoing edges (attributes of this entity) */}
                <div>
                    <h4 style={{
                        margin: '0 0 12px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        Outgoing ({outgoing.length})
                    </h4>
                    <EntityCard
                        entityId={currentEntity}
                        events={events}
                        onInspect={handleInspect}
                    />
                </div>

                {/* Incoming edges (entities pointing to this entity) */}
                {incoming.length > 0 && (
                    <div>
                        <h4 style={{
                            margin: '0 0 12px 0',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            Incoming ({incoming.length})
                        </h4>
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            padding: '16px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {incoming.map((match, i) => {
                                    const source = match.get('source');
                                    const attr = match.get('attr');

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
                                            <span
                                                onClick={() => handleInspect(source)}
                                                style={{
                                                    fontWeight: '500',
                                                    color: '#3b82f6',
                                                    fontFamily: 'ui-monospace, monospace',
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                    textDecorationStyle: 'dotted',
                                                }}
                                                title="Click to inspect"
                                            >
                                                {serialize(source)}
                                            </span>
                                            <span style={{ color: '#cbd5e1' }}>→</span>
                                            <span style={{
                                                color: '#475569',
                                                fontFamily: 'ui-monospace, monospace',
                                                fontSize: '13px',
                                            }}>
                                                {serialize(attr)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
