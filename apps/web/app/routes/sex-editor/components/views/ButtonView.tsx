import { memo, useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import styles from "../WorkspaceTree.module.css";
import { BothPorts } from "./viewUtils";

export const ButtonView = memo(({ data, selected }: NodeProps) => {
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

    const handleClick = () => {
        // If numeric, increment
        if (typeof state === "number") {
            gadget.receive(state + 1);
        }
        // If object with value, increment value
        else if (state && typeof state === "object" && typeof state.value === "number") {
            gadget.receive({ ...state, value: state.value + 1 });
        }
        // Otherwise send click event
        else {
            gadget.receive({ clicked: true, timestamp: Date.now() });
        }
    };

    // Extract label from state
    const label = state?.label || name;
    const displayValue = typeof state === "number"
        ? ` (${state})`
        : state?.value !== undefined
        ? ` (${state.value})`
        : "";

    return (
        <div
            className={`bg-gradient-to-br from-blue-500 to-blue-600 border-2 rounded-lg shadow-lg min-w-[200px] ${
                selected ? "border-blue-300 ring-2 ring-blue-200" : "border-blue-700"
            } ${isFlashing ? styles.flash : ""}`}
        >
            {/* Connection handles - top/bottom for legacy, left/right for ports */}
            <Handle type="target" position={Position.Top} className="!bg-blue-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
            <BothPorts />

            {/* Button content */}
            <div className="p-4">
                <button
                    onClick={handleClick}
                    className="w-full px-6 py-4 bg-white hover:bg-gray-100 text-blue-700 rounded-lg font-semibold text-lg shadow-md transition-all active:scale-95 active:shadow-sm"
                >
                    {label}{displayValue}
                </button>
                <div className="text-xs text-blue-100 mt-2 text-center font-mono truncate">
                    {gadget.pkg}/{gadget.name}
                </div>
            </div>
        </div>
    );
});

ButtonView.displayName = "ButtonView";
