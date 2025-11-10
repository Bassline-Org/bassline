import { useState, useMemo, useCallback } from 'react';
import { useGraph } from '../hooks/useGraph.jsx';
import { parsePatterns } from '@bassline/parser/parser';
import { pattern, patternQuad as pq } from '@bassline/parser/algebra';

/**
 * PatternEditor - Interactive pattern input with validation and live results
 *
 * @param {Object} props
 * @param {Function} [props.onExecute] - Callback when pattern is executed (cmd+enter)
 * @param {Function} [props.onError] - Callback when pattern has validation errors
 * @param {string} [props.initialValue] - Initial pattern text
 * @param {boolean} [props.showResultCount=true] - Show live result count
 *
 * @example
 * ```jsx
 * <PatternEditor
 *   initialValue="?person age ?age *"
 *   onExecute={(pattern, matches) => console.log('Execute:', matches.length)}
 *   showResultCount={true}
 * />
 * ```
 */
export function PatternEditor({
    onExecute,
    onError,
    initialValue = '',
    showResultCount = true
}) {
    const graph = useGraph();
    const [input, setInput] = useState(initialValue);
    const [focused, setFocused] = useState(false);

    // Parse and validate pattern
    const validation = useMemo(() => {
        if (!input.trim()) {
            return { valid: false, error: null, pattern: null };
        }

        try {
            const parsed = parsePatterns(input);

            // Convert parsed quads to PatternQuad objects
            const patternQuads = parsed.map(quad => {
                const [e, a, v, c] = quad;
                return pq(e, a, v, c);
            });

            const pat = pattern(...patternQuads);
            return { valid: true, error: null, pattern: pat, parsed };
        } catch (e) {
            return { valid: false, error: e.message, pattern: null };
        }
    }, [input]);

    // Execute query to get match count
    const matchCount = useMemo(() => {
        if (!validation.valid || !validation.pattern) return 0;
        try {
            const matches = graph.query(validation.pattern);
            return matches.length;
        } catch (e) {
            return 0;
        }
    }, [validation, graph]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e) => {
        // Cmd+Enter or Ctrl+Enter to execute
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (validation.valid && validation.pattern) {
                const matches = graph.query(validation.pattern);
                onExecute?.(validation.pattern, matches);
            }
        }
    }, [validation, graph, onExecute]);

    // Notify error callback when validation changes
    useMemo(() => {
        if (!validation.valid && validation.error && onError) {
            onError(validation.error);
        }
    }, [validation, onError]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}>
            <div style={{
                position: 'relative',
                border: `2px solid ${
                    focused
                        ? '#3b82f6'
                        : validation.error
                        ? '#ef4444'
                        : '#e2e8f0'
                }`,
                borderRadius: '8px',
                background: 'white',
                transition: 'border-color 0.15s',
            }}>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="?person age ?age *"
                    spellCheck={false}
                    style={{
                        width: '100%',
                        minHeight: '80px',
                        padding: '12px',
                        border: 'none',
                        outline: 'none',
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '14px',
                        resize: 'vertical',
                        background: 'transparent',
                        color: '#1e293b',
                    }}
                />

                {/* Hint text */}
                {focused && (
                    <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '12px',
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontWeight: '500',
                        pointerEvents: 'none',
                    }}>
                        {validation.valid ? '⌘+Enter to execute' : 'Invalid pattern'}
                    </div>
                )}
            </div>

            {/* Status bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: validation.error ? '#fef2f2' : '#f8fafc',
                borderRadius: '6px',
                fontSize: '12px',
                minHeight: '36px',
            }}>
                {validation.error ? (
                    <span style={{ color: '#dc2626', fontWeight: '500' }}>
                        {validation.error}
                    </span>
                ) : validation.valid && showResultCount ? (
                    <span style={{ color: '#64748b', fontWeight: '500' }}>
                        {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                    </span>
                ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                        Enter a pattern to search
                    </span>
                )}

                {validation.valid && (
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                    }}>
                        <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#10b981',
                        }} />
                        <span style={{ color: '#059669', fontSize: '11px', fontWeight: '600' }}>
                            VALID
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
