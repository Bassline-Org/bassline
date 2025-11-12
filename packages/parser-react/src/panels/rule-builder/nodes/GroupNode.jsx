/**
 * GroupNode - Container node for pattern/production/NAC groups
 *
 * Represents a context (collection of quads)
 */

import { memo, useState } from "react";
import { useReactFlow } from "@xyflow/react";

export const GroupNode = memo(({ id, data }) => {
    const { label, color = "blue", context = "*" } = data;
    const { setNodes } = useReactFlow();
    const [isEditingContext, setIsEditingContext] = useState(false);
    const [contextValue, setContextValue] = useState(context);

    const borderColors = {
        blue: "border-blue-500",
        green: "border-green-500",
        red: "border-red-500",
    };

    const bgColors = {
        blue: "bg-blue-200",
        green: "bg-green-200",
        red: "bg-red-200",
    };

    const headerColors = {
        blue: "text-blue-900 bg-gradient-to-r from-blue-200 to-blue-300",
        green: "text-green-900 bg-gradient-to-r from-green-200 to-green-300",
        red: "text-red-900 bg-gradient-to-r from-red-200 to-red-300",
    };

    const handleContextChange = (newContext) => {
        setContextValue(newContext);
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, context: newContext } }
                    : node
            )
        );
    };

    const handleContextBlur = () => {
        setIsEditingContext(false);
        if (contextValue.trim() === "") {
            handleContextChange("*");
            setContextValue("*");
        }
    };

    return (
        <div
            className={`${bgColors[color]} ${
                borderColors[color]
            } w-full h-full shadow-md rounded-lg`}
            style={{
                pointerEvents: "auto",
            }}
        >
            <div
                className={`${headerColors[color]} px-4 py-3 border-b-4 ${
                    borderColors[color]
                } flex items-center gap-3 font-bold text-lg shadow-md`}
            >
                <span>{label}</span>
                <span className="text-xs font-mono font-normal opacity-75">
                    (
                    {isEditingContext
                        ? (
                            <input
                                type="text"
                                value={contextValue}
                                onChange={(e) =>
                                    setContextValue(e.target.value)}
                                onBlur={handleContextBlur}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleContextChange(contextValue);
                                        setIsEditingContext(false);
                                    } else if (e.key === "Escape") {
                                        setContextValue(context);
                                        setIsEditingContext(false);
                                    }
                                }}
                                className="bg-white border border-gray-400 rounded px-2 py-0.5 font-mono text-xs w-24"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        )
                        : (
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingContext(true);
                                }}
                                className="cursor-pointer hover:bg-white hover:bg-opacity-50 px-2 py-0.5 rounded transition-colors"
                                title="Click to edit context"
                            >
                                {context}
                            </span>
                        )}
                    )
                </span>
            </div>
            <div className="p-4" style={{ pointerEvents: "none" }}>
                {/* Group content area */}
            </div>
        </div>
    );
});

GroupNode.displayName = "GroupNode";
