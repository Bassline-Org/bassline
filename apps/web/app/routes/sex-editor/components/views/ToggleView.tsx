import { memo, useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import styles from "../WorkspaceTree.module.css";

export const ToggleView = memo(({ data, selected }: NodeProps) => {
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

    // Extract boolean value
    const isOn = typeof state === "boolean" ? state : !!state?.value;
    const label = state?.label || name;

    const handleToggle = () => {
        // If state is just a boolean, send boolean
        if (typeof state === "boolean") {
            gadget.receive(!isOn);
        }
        // If state is object, preserve other properties
        else if (state && typeof state === "object") {
            gadget.receive({ ...state, value: !isOn });
        }
        // Otherwise send boolean
        else {
            gadget.receive(!isOn);
        }
    };

    return (
        <div
            className={`bg-white border-2 rounded-lg shadow-lg min-w-[240px] ${
                selected ? "border-amber-500 ring-2 ring-amber-300" : "border-amber-400"
            } ${isFlashing ? styles.flash : ""}`}
        >
            {/* Connection handles */}
            <Handle type="target" position={Position.Top} className="!bg-amber-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />

            {/* Content */}
            <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-gray-700 flex-1">{label}</span>
                    <button
                        onClick={handleToggle}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                            isOn ? "bg-amber-500" : "bg-gray-300"
                        }`}
                        role="switch"
                        aria-checked={isOn}
                    >
                        <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                isOn ? "translate-x-7" : "translate-x-1"
                            }`}
                        />
                    </button>
                </div>

                <div className="mt-4 text-center">
                    <span className={`text-sm font-medium ${isOn ? "text-amber-600" : "text-gray-400"}`}>
                        {isOn ? "ON" : "OFF"}
                    </span>
                </div>

                <div className="text-xs text-gray-400 font-mono truncate text-center mt-2">
                    {gadget.pkg}/{gadget.name}
                </div>
            </div>
        </div>
    );
});

ToggleView.displayName = "ToggleView";
