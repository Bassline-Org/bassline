import { useState } from "react";
import { useGraph } from "../hooks/useGraph.jsx";
import { word as w } from "@bassline/parser/types";
import { quad as q } from "@bassline/parser/algebra";

/**
 * RuleEditor - Create and edit reified rules
 *
 * Provides a visual interface for creating rules with pattern input,
 * live match preview, and save functionality. Rules are stored as
 * edges in the graph using the reified rules pattern.
 *
 * @param {Object} props
 * @param {string} [props.initialRuleName] - Rule to edit (optional)
 * @param {Function} [props.onSave] - Callback after save (receives ruleName)
 * @param {Function} [props.onCancel] - Callback when cancel is clicked
 *
 * @example
 * ```jsx
 * <RuleEditor
 *   onSave={(ruleName) => console.log('Saved:', ruleName)}
 *   onCancel={() => console.log('Cancelled')}
 *   events={events}
 * />
 * ```
 */
export function RuleEditor({ initialRuleName, onSave, onCancel }) {
    const graph = useGraph();
    const [ruleName, setRuleName] = useState(initialRuleName || "");
    const [matchPattern, setMatchPattern] = useState("?person age ?age ?c");
    const [producePattern, setProducePattern] = useState(
        "?person has-age true ?c",
    );
    const [error, setError] = useState(null);
    const [autoActivate, setAutoActivate] = useState(true);

    const handleSave = () => {
        setError(null);

        // Validate inputs
        if (!ruleName.trim()) {
            setError("Rule name is required");
            return;
        }
        if (!matchPattern.trim()) {
            setError("Match pattern is required");
            return;
        }
        if (!producePattern.trim()) {
            setError("Produce pattern is required");
            return;
        }

        try {
            const ruleWord = w(ruleName);
            const systemCtx = w("system");
            const ruleCtx = w(ruleName);

            // Write rule structure as edges
            graph.add(q(ruleWord, w("TYPE"), w("RULE!"), systemCtx));
            graph.add(q(ruleWord, w("matches"), matchPattern, ruleCtx));
            graph.add(q(ruleWord, w("produces"), producePattern, ruleCtx));

            // Activate if requested
            if (autoActivate) {
                graph.add(q(ruleWord, w("memberOf"), w("rule"), systemCtx));
            }

            // Callback
            onSave?.(ruleName);

            // Reset form
            setRuleName("");
            setMatchPattern("");
            setProducePattern("");
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const isValid = ruleName.trim() && matchPattern.trim() &&
        producePattern.trim();

    return (
        <div
            style={{
                background: "white",
                borderRadius: "8px",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
        >
            <h3
                style={{
                    margin: "0 0 16px 0",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1e293b",
                }}
            >
                {initialRuleName
                    ? `Edit Rule: ${initialRuleName}`
                    : "Create New Rule"}
            </h3>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                }}
            >
                {/* Rule name */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                    }}
                >
                    <label
                        style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#475569",
                        }}
                    >
                        Rule Name
                    </label>
                    <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        placeholder="ADULT-CHECK"
                        style={{
                            padding: "8px 12px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            fontSize: "14px",
                            fontFamily: "ui-monospace, monospace",
                            outline: "none",
                            transition: "border-color 0.15s",
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                        onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                    />
                </div>

                {/* Match pattern */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                    }}
                >
                    <label
                        style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#475569",
                        }}
                    >
                        Match Pattern
                    </label>
                    <textarea
                        value={matchPattern}
                        onChange={(e) => setMatchPattern(e.target.value)}
                        placeholder="?person AGE ?age *"
                        rows={3}
                        style={{
                            padding: "8px 12px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontFamily: "ui-monospace, monospace",
                            outline: "none",
                            resize: "vertical",
                            transition: "border-color 0.15s",
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                        onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                    />
                    <span
                        style={{
                            fontSize: "11px",
                            color: "#64748b",
                        }}
                    >
                        Use pattern syntax like: ?person age ?age *
                    </span>
                </div>

                {/* Produce pattern */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                    }}
                >
                    <label
                        style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#475569",
                        }}
                    >
                        Produce Pattern
                    </label>
                    <textarea
                        value={producePattern}
                        onChange={(e) => setProducePattern(e.target.value)}
                        placeholder="?person ADULT TRUE *"
                        rows={3}
                        style={{
                            padding: "8px 12px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontFamily: "ui-monospace, monospace",
                            outline: "none",
                            resize: "vertical",
                            transition: "border-color 0.15s",
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                        onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                    />
                </div>

                {/* Auto-activate checkbox */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <input
                        type="checkbox"
                        id="auto-activate"
                        checked={autoActivate}
                        onChange={(e) => setAutoActivate(e.target.checked)}
                        style={{ cursor: "pointer" }}
                    />
                    <label
                        htmlFor="auto-activate"
                        style={{
                            fontSize: "13px",
                            color: "#475569",
                            cursor: "pointer",
                        }}
                    >
                        Activate rule immediately after saving
                    </label>
                </div>

                {/* Error message */}
                {error && (
                    <div
                        style={{
                            padding: "12px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "6px",
                            color: "#dc2626",
                            fontSize: "13px",
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* Action buttons */}
                <div
                    style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "flex-end",
                    }}
                >
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            style={{
                                padding: "10px 16px",
                                background: "white",
                                color: "#475569",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) =>
                                e.target.style.background = "#f8fafc"}
                            onMouseLeave={(e) =>
                                e.target.style.background = "white"}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!isValid}
                        style={{
                            padding: "10px 16px",
                            background: isValid ? "#3b82f6" : "#cbd5e1",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "14px",
                            fontWeight: "500",
                            cursor: isValid ? "pointer" : "not-allowed",
                            transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                            if (isValid) e.target.style.background = "#2563eb";
                        }}
                        onMouseLeave={(e) => {
                            if (isValid) e.target.style.background = "#3b82f6";
                        }}
                    >
                        Save Rule
                    </button>
                </div>
            </div>
        </div>
    );
}
