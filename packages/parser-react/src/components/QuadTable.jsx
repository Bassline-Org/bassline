import { useMemo } from 'react';
import { useQuery } from '../hooks/useQuery.js';
import { serialize } from '@bassline/parser/types';

/**
 * QuadTable - Display pattern match results in a table
 *
 * Graph-native component that queries using a Pattern and displays
 * variable bindings as columns. Automatically updates when graph changes.
 *
 * @param {Object} props
 * @param {Pattern} props.pattern - Pattern object from pattern() constructor
 * @param {EventTarget} props.events - EventTarget from instrument(graph)
 * @param {Function} [props.onInspect] - Callback when clicking a cell value
 *
 * @example
 * ```jsx
 * import { pattern, patternQuad as pq } from '@bassline/parser/algebra';
 * import { variable as v, word as w } from '@bassline/parser/types';
 *
 * const peoplePattern = pattern(pq(v('person'), w('age'), v('age')));
 *
 * <QuadTable
 *   pattern={peoplePattern}
 *   events={events}
 *   onInspect={(value) => console.log('Inspect:', value)}
 * />
 * ```
 */
export function QuadTable({ pattern, events, onInspect }) {
    const matches = useQuery(pattern, events);

    // Extract variable names from first match
    const variables = useMemo(() => {
        if (matches.length === 0) return [];

        const firstMatch = matches[0];

        // Bindings use Symbol keys, so we need getOwnPropertySymbols
        const symbolKeys = Object.getOwnPropertySymbols(firstMatch.bindings);
        const vars = symbolKeys.map(sym => sym.description);

        return vars.sort();
    }, [matches]);

    if (matches.length === 0) {
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
                No matches found
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
            <div style={{ overflowX: 'auto' }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    fontSize: '13px',
                }}>
                    <thead>
                        <tr style={{
                            background: '#f8fafc',
                            borderBottom: '2px solid #e2e8f0',
                        }}>
                            {variables.map((varName) => (
                                <th
                                    key={varName}
                                    style={{
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        fontWeight: '600',
                                        color: '#475569',
                                        fontFamily: 'ui-monospace, monospace',
                                    }}
                                >
                                    {varName.toString()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matches.map((match, rowIndex) => (
                            <tr
                                key={rowIndex}
                                style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                }}
                            >
                                {variables.map((varName) => {
                                    const value = match.get(varName);

                                    return (
                                        <td
                                            key={varName}
                                            onClick={() => onInspect && onInspect(value)}
                                            style={{
                                                padding: '12px 16px',
                                                color: '#1e293b',
                                                fontFamily: 'ui-monospace, monospace',
                                                cursor: onInspect ? 'pointer' : 'default',
                                                textDecoration: onInspect ? 'underline' : 'none',
                                                textDecorationStyle: 'dotted',
                                            }}
                                            title={onInspect ? 'Click to inspect' : ''}
                                        >
                                            {serialize(value)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{
                padding: '12px 16px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                color: '#64748b',
                fontSize: '12px',
                fontWeight: '500',
            }}>
                {matches.length} {matches.length === 1 ? 'match' : 'matches'}
            </div>
        </div>
    );
}
