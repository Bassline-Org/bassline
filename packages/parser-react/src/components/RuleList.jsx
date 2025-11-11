import { useActiveRules, useRuleDetails } from "../hooks/useActiveRules.js";
import { useGraph } from "../hooks/useGraph.jsx";
import { word as w } from "@bassline/parser/types";
import { quad as q } from "@bassline/parser/algebra";

/**
 * RuleList - Browse and manage reified rules
 *
 * Shows all rules in the graph with their status, patterns, and controls.
 * Click to select a rule for inspection. Toggle active/inactive status.
 *
 * @param {Object} props
 * @param {EventTarget} props.events - EventTarget from instrument(graph)
 * @param {Function} [props.onSelect] - Callback when clicking a rule (receives rule name)
 * @param {Function} [props.onToggle] - Callback when toggling rule active state
 *
 * @example
 * ```jsx
 * <RuleList
 *   events={events}
 *   onSelect={(ruleName) => console.log('Selected:', ruleName)}
 *   onToggle={(ruleName, active) => console.log('Toggled:', ruleName, active)}
 * />
 * ```
 */
export function RuleList({ events, onSelect, onToggle }) {
    const rules = useActiveRules(events);

    if (rules.length === 0) {
        return (
            <div
                style={{
                    background: "white",
                    borderRadius: "8px",
                    padding: "24px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    fontSize: "14px",
                }}
            >
                No rules defined
            </div>
        );
    }

    return (
        <div
            style={{
                background: "white",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: "12px 16px",
                    background: "#f8fafc",
                    borderBottom: "2px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <span
                    style={{
                        fontWeight: "600",
                        fontSize: "14px",
                        color: "#475569",
                        fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                >
                    Reified Rules
                </span>
                <span
                    style={{
                        fontSize: "12px",
                        color: "#64748b",
                        fontWeight: "500",
                        fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    }}
                >
                    {rules.length}
                </span>
            </div>

            {/* Rule list */}
            <div
                style={{
                    maxHeight: "600px",
                    overflowY: "auto",
                }}
            >
                {rules.map((rule, index) => (
                    <RuleRow
                        key={rule.nameStr}
                        rule={rule}
                        events={events}
                        isLast={index === rules.length - 1}
                        onSelect={onSelect}
                        onToggle={onToggle}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * RuleRow - Individual rule display with controls
 * @private
 */
function RuleRow({ rule, events, isLast, onSelect, onToggle }) {
    const graph = useGraph();
    const details = useRuleDetails(rule, events);

    const handleToggle = (e) => {
        e.stopPropagation();

        if (!details) return;

        // Toggle by adding/removing memberOf edge
        if (details.isActive) {
            // Deactivate: add tombstone
            graph.add(
                q(rule, w("memberOf"), w("rule"), w("tombstone")),
            );
        } else {
            // Activate: add to system
            graph.add(
                q(rule, w("memberOf"), w("rule"), w("system")),
            );
        }

        onToggle?.(rule, !details.isActive);
    };

    if (!details) {
        return (
            <div
                style={{
                    padding: "12px 16px",
                    borderBottom: isLast ? "none" : "1px solid #f1f5f9",
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    color: "#94a3b8",
                    fontSize: "13px",
                }}
            >
                Loading rule details...
            </div>
        );
    }

    return (
        <div
            onClick={() => onSelect && onSelect(rule)}
            style={{
                padding: "16px",
                borderBottom: isLast ? "none" : "1px solid #f1f5f9",
                cursor: onSelect ? "pointer" : "default",
                transition: "background 0.15s",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
            onMouseEnter={(e) => {
                if (onSelect) {
                    e.currentTarget.style.background = "#f8fafc";
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
            }}
        >
            {/* Rule name and status */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <span
                        style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            color: "#1e293b",
                            fontFamily: "ui-monospace, monospace",
                        }}
                    >
                        {rule.name}
                    </span>
                    <span
                        style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "600",
                            textTransform: "uppercase",
                            background: details.isActive
                                ? "#dcfce7"
                                : "#fee2e2",
                            color: details.isActive ? "#15803d" : "#dc2626",
                        }}
                    >
                        {details.isActive ? "Active" : "Inactive"}
                    </span>
                </div>

                {/* Toggle button */}
                <button
                    onClick={handleToggle}
                    style={{
                        padding: "4px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "500",
                        border: details.isActive
                            ? "1px solid #dc2626"
                            : "1px solid #16a34a",
                        background: "white",
                        color: details.isActive ? "#dc2626" : "#16a34a",
                        cursor: "pointer",
                        transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = details.isActive
                            ? "#fee2e2"
                            : "#dcfce7";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "white";
                    }}
                >
                    {details.isActive ? "Deactivate" : "Activate"}
                </button>
            </div>

            {/* Match pattern */}
            {details.matchPattern && (
                <div style={{ marginBottom: "6px" }}>
                    <span
                        style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                        }}
                    >
                        Matches:
                    </span>
                    <pre
                        style={{
                            margin: "4px 0 0 0",
                            padding: "8px",
                            background: "#f8fafc",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontFamily: "ui-monospace, monospace",
                            color: "#475569",
                            overflow: "auto",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                        }}
                    >
                        {details.matchPattern}
                    </pre>
                </div>
            )}

            {/* Produce pattern */}
            {details.producePattern && (
                <div>
                    <span
                        style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                        }}
                    >
                        Produces:
                    </span>
                    <pre
                        style={{
                            margin: "4px 0 0 0",
                            padding: "8px",
                            background: "#f0f9ff",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontFamily: "ui-monospace, monospace",
                            color: "#0369a1",
                            overflow: "auto",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                        }}
                    >
                        {details.producePattern}
                    </pre>
                </div>
            )}
        </div>
    );
}
