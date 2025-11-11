import { useMemo } from 'react';
import { useRuleDetails } from '../hooks/useActiveRules.js';
import { useQuery } from '../hooks/useQuery.js';
import { pattern, patternQuad as pq } from '@bassline/parser/algebra';
import { variable as v, word as w, isWord } from '@bassline/parser/types';
import { serialize } from '@bassline/parser/types';

/**
 * RuleDebugger - Deep inspection of rule execution
 *
 * Shows detailed information about a rule including firing history,
 * source quads that triggered firings, and resulting produced quads.
 *
 * @param {Object} props
 * @param {Word} props.ruleName - Rule to debug
 * @param {EventTarget} props.events - EventTarget from instrument(graph)
 * @param {Function} [props.onClose] - Callback when close button clicked
 *
 * @example
 * ```jsx
 * <RuleDebugger
 *   ruleName={w("ADULT-CHECK")}
 *   events={events}
 *   onClose={() => setShowDebugger(false)}
 * />
 * ```
 */
export function RuleDebugger({ ruleName, events, onClose }) {
    const details = useRuleDetails(ruleName, events);

    // Query for rule firing events (if any)
    // Pattern: ruleName FIRED ?timestamp ?
    const nameKey = ruleName?.spelling?.description || ruleName;
    const firingsPattern = useMemo(() => {
        return pattern(
            pq(ruleName, w('FIRED'), v('timestamp'), v('ctx'))
        );
    }, [nameKey]);

    const firings = useQuery(firingsPattern, events);

    // Query for produced quads by this rule
    // Pattern: ?s ?a ?t ruleName
    const producedPattern = useMemo(() => {
        return pattern(
            pq(v('s'), v('a'), v('t'), ruleName)
        );
    }, [nameKey]);

    const producedQuads = useQuery(producedPattern, events);

    if (!details) {
        return (
            <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}>
                <p style={{ color: '#64748b' }}>Loading rule details...</p>
            </div>
        );
    }

    return (
        <div style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                background: '#f8fafc',
                borderBottom: '2px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <h3 style={{
                        margin: '0 0 4px 0',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e293b',
                        fontFamily: 'ui-monospace, monospace',
                    }}>
                        {details.nameStr}
                    </h3>
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        background: details.isActive ? '#dcfce7' : '#fee2e2',
                        color: details.isActive ? '#15803d' : '#dc2626',
                    }}>
                        {details.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>

                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            padding: '6px 12px',
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                    >
                        Close
                    </button>
                )}
            </div>

            <div style={{ padding: '20px' }}>
                {/* Rule patterns */}
                <div style={{ marginBottom: '24px' }}>
                    <h4 style={{
                        margin: '0 0 12px 0',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        Patterns
                    </h4>

                    {details.matchPattern && (
                        <div style={{ marginBottom: '12px' }}>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#64748b',
                            }}>
                                Matches:
                            </span>
                            <pre style={{
                                margin: '4px 0 0 0',
                                padding: '12px',
                                background: '#f8fafc',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontFamily: 'ui-monospace, monospace',
                                color: '#475569',
                                overflow: 'auto',
                            }}>
                                {details.matchPattern}
                            </pre>
                        </div>
                    )}

                    {details.producePattern && (
                        <div>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#64748b',
                            }}>
                                Produces:
                            </span>
                            <pre style={{
                                margin: '4px 0 0 0',
                                padding: '12px',
                                background: '#f0f9ff',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontFamily: 'ui-monospace, monospace',
                                color: '#0369a1',
                                overflow: 'auto',
                            }}>
                                {details.producePattern}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Statistics */}
                <div style={{ marginBottom: '24px' }}>
                    <h4 style={{
                        margin: '0 0 12px 0',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        Statistics
                    </h4>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '12px',
                    }}>
                        <div style={{
                            padding: '12px',
                            background: '#f0fdf4',
                            borderRadius: '6px',
                            border: '1px solid #bbf7d0',
                        }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#15803d',
                                marginBottom: '4px',
                            }}>
                                Quads Produced
                            </div>
                            <div style={{
                                fontSize: '24px',
                                fontWeight: '700',
                                color: '#14532d',
                                fontFamily: 'ui-monospace, monospace',
                            }}>
                                {producedQuads.length}
                            </div>
                        </div>

                        <div style={{
                            padding: '12px',
                            background: '#f0f9ff',
                            borderRadius: '6px',
                            border: '1px solid #bae6fd',
                        }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#0369a1',
                                marginBottom: '4px',
                            }}>
                                Times Fired
                            </div>
                            <div style={{
                                fontSize: '24px',
                                fontWeight: '700',
                                color: '#0c4a6e',
                                fontFamily: 'ui-monospace, monospace',
                            }}>
                                {firings.length}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Produced quads */}
                <div style={{ marginBottom: '24px' }}>
                    <h4 style={{
                        margin: '0 0 12px 0',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        Produced Quads ({producedQuads.length})
                    </h4>

                    {producedQuads.length === 0 ? (
                        <div style={{
                            padding: '16px',
                            background: '#f8fafc',
                            borderRadius: '6px',
                            textAlign: 'center',
                            color: '#94a3b8',
                            fontSize: '13px',
                        }}>
                            No quads produced yet
                        </div>
                    ) : (
                        <div style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                        }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                            }}>
                                <thead>
                                    <tr style={{
                                        background: '#f8fafc',
                                        borderBottom: '2px solid #e2e8f0',
                                    }}>
                                        <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'left',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                        }}>
                                            Source
                                        </th>
                                        <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'left',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                        }}>
                                            Attribute
                                        </th>
                                        <th style={{
                                            padding: '8px 12px',
                                            textAlign: 'left',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                        }}>
                                            Target
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {producedQuads.map((quad, i) => (
                                        <tr
                                            key={i}
                                            style={{
                                                borderBottom: i < producedQuads.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            }}
                                        >
                                            <td style={{
                                                padding: '10px 12px',
                                                fontSize: '12px',
                                                fontFamily: 'ui-monospace, monospace',
                                                color: '#1e293b',
                                            }}>
                                                {serialize(quad.get('s'))}
                                            </td>
                                            <td style={{
                                                padding: '10px 12px',
                                                fontSize: '12px',
                                                fontFamily: 'ui-monospace, monospace',
                                                color: '#1e293b',
                                            }}>
                                                {serialize(quad.get('a'))}
                                            </td>
                                            <td style={{
                                                padding: '10px 12px',
                                                fontSize: '12px',
                                                fontFamily: 'ui-monospace, monospace',
                                                color: '#1e293b',
                                            }}>
                                                {serialize(quad.get('t'))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Firing history */}
                {firings.length > 0 && (
                    <div>
                        <h4 style={{
                            margin: '0 0 12px 0',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#475569',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            Firing History ({firings.length})
                        </h4>

                        <div style={{
                            maxHeight: '200px',
                            overflowY: 'auto',
                        }}>
                            {firings.map((firing, i) => {
                                const timestamp = firing.get('timestamp');
                                const ctx = firing.get('ctx');
                                return (
                                    <div
                                        key={i}
                                        style={{
                                            padding: '10px 12px',
                                            background: '#f8fafc',
                                            borderRadius: '6px',
                                            marginBottom: '6px',
                                            fontSize: '12px',
                                            fontFamily: 'ui-monospace, monospace',
                                            color: '#475569',
                                        }}
                                    >
                                        <span style={{ color: '#64748b' }}>Timestamp:</span> {serialize(timestamp)}
                                        {' '}
                                        <span style={{ color: '#64748b' }}>Context:</span> {serialize(ctx)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
