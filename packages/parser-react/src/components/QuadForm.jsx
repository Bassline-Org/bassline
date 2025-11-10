import { useState } from 'react';
import { quad as q } from '@bassline/parser/algebra';
import { word as w } from '@bassline/parser/types';
import { useGraph } from '../hooks/useGraph.jsx';

/**
 * QuadForm - Create and edit quads in the graph
 *
 * Provides a form for adding new quads with validation.
 * Values are automatically parsed to appropriate types.
 *
 * @param {Object} props
 * @param {Function} [props.onSubmit] - Callback after quad is added (receives quad)
 * @param {Object} [props.initialValues] - Pre-fill form with {source, attr, target, context}
 *
 * @example
 * ```jsx
 * <QuadForm
 *   onSubmit={(quad) => console.log('Added:', quad)}
 *   initialValues={{ source: 'alice', attr: 'age' }}
 * />
 * ```
 */
export function QuadForm({ onSubmit, initialValues = {} }) {
    const graph = useGraph();
    const [source, setSource] = useState(initialValues.source || '');
    const [attr, setAttr] = useState(initialValues.attr || '');
    const [target, setTarget] = useState(initialValues.target || '');
    const [context, setContext] = useState(initialValues.context || 'user');
    const [error, setError] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);

        // Validate inputs
        if (!source.trim()) {
            setError('Source is required');
            return;
        }
        if (!attr.trim()) {
            setError('Attribute is required');
            return;
        }
        if (!target.trim()) {
            setError('Target is required');
            return;
        }

        try {
            // Parse target - if it's a number, use it; otherwise word
            let targetValue;
            const numValue = parseFloat(target);
            if (!isNaN(numValue) && target.trim() === String(numValue)) {
                targetValue = numValue;
            } else {
                targetValue = w(target);
            }

            // Create quad
            const quad = q(
                w(source),
                w(attr),
                targetValue,
                w(context)
            );

            // Add to graph
            graph.add(quad);

            // Callback
            onSubmit?.(quad);

            // Reset form
            setSource('');
            setAttr('');
            setTarget('');
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}>
            <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e293b',
            }}>
                Add Quad
            </h3>

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Source */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#475569',
                        }}>
                            Source (Subject)
                        </label>
                        <input
                            type="text"
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            placeholder="alice"
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontFamily: 'ui-monospace, monospace',
                                outline: 'none',
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {/* Attribute */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#475569',
                        }}>
                            Attribute (Predicate)
                        </label>
                        <input
                            type="text"
                            value={attr}
                            onChange={(e) => setAttr(e.target.value)}
                            placeholder="age"
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontFamily: 'ui-monospace, monospace',
                                outline: 'none',
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {/* Target */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#475569',
                        }}>
                            Target (Object)
                        </label>
                        <input
                            type="text"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="30 or bob"
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontFamily: 'ui-monospace, monospace',
                                outline: 'none',
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <span style={{
                            fontSize: '11px',
                            color: '#64748b',
                        }}>
                            Numbers are parsed automatically
                        </span>
                    </div>

                    {/* Context */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#475569',
                        }}>
                            Context
                        </label>
                        <input
                            type="text"
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="user"
                            style={{
                                padding: '8px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontFamily: 'ui-monospace, monospace',
                                outline: 'none',
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {/* Error message */}
                    {error && (
                        <div style={{
                            padding: '12px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            color: '#dc2626',
                            fontSize: '13px',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        style={{
                            padding: '10px 16px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                        onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                    >
                        Add Quad
                    </button>
                </div>
            </form>
        </div>
    );
}
