import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export const ToggleView = memo(({ data }: NodeProps) => {
    const { gadget } = data as any;
    const state = gadget.useCurrent();

    // Extract boolean value
    const isOn = typeof state === "boolean" ? state : !!state?.value;
    const label = state?.label || "toggle";

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
        </div>
    );
});

ToggleView.displayName = "ToggleView";
