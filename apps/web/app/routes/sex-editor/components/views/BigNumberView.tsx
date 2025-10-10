import { memo, useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import styles from "../WorkspaceTree.module.css";

export const BigNumberView = memo(({ data, selected }: NodeProps) => {
    const { name, gadget } = data;
    const state = gadget.useCurrent();
    const [isFlashing, setIsFlashing] = useState(false);

    // Flash animation on receive
    useEffect(() => {
        const cleanup = gadget.tap(() => {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);
        });
        return cleanup;
    }, [gadget]);

    // Format number for display
    const displayValue = typeof state === "number"
        ? state.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : String(state);

    return (
        <div
            className={`bg-gradient-to-br from-green-50 to-green-100 border-2 rounded-lg shadow-lg min-w-[200px] ${
                selected ? "border-green-500 ring-2 ring-green-300" : "border-green-400"
            } ${isFlashing ? styles.flash : ""}`}
        >
            {/* Connection handles */}
            <Handle type="target" position={Position.Top} className="!bg-green-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-green-500" />

            {/* Content */}
            <div className="p-6 text-center space-y-2">
                <div className="text-5xl font-bold text-green-700">
                    {displayValue}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                    {name}
                </div>
                <div className="text-xs text-gray-400 font-mono">
                    {gadget.pkg}/{gadget.name}
                </div>
            </div>
        </div>
    );
});

BigNumberView.displayName = "BigNumberView";
