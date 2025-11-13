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

    // Background gradient based on literal type
    const getBackground = () => {
        switch (literalType) {
            case 'number':
                return 'linear-gradient(to bottom right, rgb(74, 222, 128), rgb(34, 197, 94))';
            case 'string':
                return 'linear-gradient(to bottom right, rgb(251, 191, 36), rgb(245, 158, 11))';
            default:
                return 'linear-gradient(to bottom right, rgb(96, 165, 250), rgb(59, 130, 246))';
        }
    };

    return (
        <div
            className="relative bg-gradient-to-br from-blue-400 to-blue-500 text-white rounded-full flex items-center justify-center font-mono text-xs font-semibold cursor-pointer hover:from-blue-500 hover:to-blue-600 shadow-lg transition-all px-3"
            style={{
                width: '100%',
                height: '100%',
                background: getBackground(),
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            title="Double-click to edit"
        >
            <Handle type="target" position={Position.Left} style={{ left: -4, width: 8, height: 8 }} />

            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-center w-full">
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
                            className="bg-white text-gray-900 border border-blue-400 rounded px-2 py-1 text-xs font-mono text-center w-full"
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
