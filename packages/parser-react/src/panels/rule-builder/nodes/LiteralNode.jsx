/**
 * LiteralNode - Represents a literal value (e.g., "age", 30, true, null)
 * Double-click to edit
 */

import { useState, memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";

export const LiteralNode = memo(({ id, data }) => {
    const { label, literalType = "word" } = data;
    const { setNodes } = useReactFlow();

    const [isEditing, setIsEditing] = useState(false);
    const [labelValue, setLabelValue] = useState(label);

    const handleLabelChange = (newLabel) => {
        setLabelValue(newLabel);
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, label: newLabel } }
                    : node
            )
        );
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (labelValue.trim() === "") {
            handleLabelChange(label);
            setLabelValue(label);
        }
    };

    // Styling based on literal type
    const typeStyles = {
        word: {
            bg: "bg-gradient-to-br from-blue-400 to-blue-500",
            border: "border-blue-600",
            hover: "hover:from-blue-500 hover:to-blue-600",
            text: "text-white",
            badge: "bg-blue-700 text-white",
            badgeText: "word",
        },
        number: {
            bg: "bg-gradient-to-br from-green-400 to-green-500",
            border: "border-green-600",
            hover: "hover:from-green-500 hover:to-green-600",
            text: "text-white",
            badge: "bg-green-700 text-white",
            badgeText: "num",
        },
        string: {
            bg: "bg-gradient-to-br from-amber-400 to-amber-500",
            border: "border-amber-600",
            hover: "hover:from-amber-500 hover:to-amber-600",
            text: "text-white",
            badge: "bg-amber-700 text-white",
            badgeText: "str",
        },
    };

    const styles = typeStyles[literalType] || typeStyles.word;

    return (
        <div className="relative flex flex-col items-center justify-center" style={{ width: '100%', height: '100%' }}>
            <Handle type="target" position={Position.Left} style={{ left: -4, width: 8, height: 8 }} />

            {/* Type badge */}
            <div
                className={`${styles.badge} px-3 py-1 rounded-t text-xs font-semibold`}
            >
                {styles.badgeText}
            </div>

            {/* Main node */}
            <div
                className={`${styles.bg} ${styles.hover} ${styles.text} rounded-b-lg px-6 py-3 font-mono text-lg font-semibold min-w-[120px] text-center cursor-pointer transition-all shadow-md`}
                style={{
                    background: literalType === 'number'
                        ? 'linear-gradient(to bottom right, rgb(74, 222, 128), rgb(34, 197, 94))'
                        : literalType === 'string'
                        ? 'linear-gradient(to bottom right, rgb(251, 191, 36), rgb(245, 158, 11))'
                        : 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(59, 130, 246))',
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                }}
                title="Double-click to edit"
            >
                {isEditing
                    ? (
                        <input
                            type="text"
                            value={labelValue}
                            onChange={(e) => setLabelValue(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleLabelChange(labelValue);
                                    setIsEditing(false);
                                } else if (e.key === "Escape") {
                                    setLabelValue(label);
                                    setIsEditing(false);
                                }
                            }}
                            className="bg-white text-gray-900 border border-blue-400 rounded px-2 py-1 text-sm font-mono text-center min-w-[80px]"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    )
                    : label}
            </div>

            <Handle type="source" position={Position.Right} style={{ right: -4, width: 8, height: 8 }} />
        </div>
    );
});

LiteralNode.displayName = "LiteralNode";
