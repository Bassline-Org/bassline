/**
 * VariableNode - Represents a variable in the graph (e.g., ?person, ?age)
 *
 * Variables can connect across pattern/production groups
 * Double-click to rename
 */

import { memo, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";

export const VariableNode = memo(({ id, data }) => {
    const { label } = data;
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
        if (!labelValue.trim().startsWith("?")) {
            const corrected = "?" + labelValue.trim();
            handleLabelChange(corrected);
            setLabelValue(corrected);
        } else if (labelValue.trim() === "?") {
            handleLabelChange(label);
            setLabelValue(label);
        }
    };

    return (
        <div
            className="relative bg-gradient-to-br from-purple-400 to-purple-600 text-white rounded-full flex items-center justify-center font-mono text-xs font-semibold cursor-pointer hover:from-purple-500 hover:to-purple-700 shadow-lg transition-all px-3"
            style={{
                width: "100%",
                height: "100%",
                background:
                    "linear-gradient(to bottom right, rgb(192, 132, 252), rgb(147, 51, 234))",
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            title="Double-click to rename"
        >
            <Handle
                type="target"
                position={Position.Left}
                style={{ left: -4, width: 8, height: 8 }}
            />

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

            <Handle
                type="source"
                position={Position.Right}
                style={{ right: -4, width: 8, height: 8 }}
            />
        </div>
    );
});

VariableNode.displayName = "VariableNode";
