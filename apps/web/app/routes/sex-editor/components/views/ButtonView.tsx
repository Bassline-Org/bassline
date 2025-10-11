import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export const ButtonView = memo(({ data }: NodeProps) => {
    const { gadget } = data as any;
    const state = gadget.useCurrent();

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
    const label = state?.label || "button";
    const displayValue = typeof state === "number"
        ? ` (${state})`
        : state?.value !== undefined
        ? ` (${state.value})`
        : "";

    return (
        <div className="p-4">
            <button
                onClick={handleClick}
                className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg shadow-md transition-all active:scale-95 active:shadow-sm"
            >
                {label}{displayValue}
            </button>
        </div>
    );
});

ButtonView.displayName = "ButtonView";
