import { memo, useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import styles from "../WorkspaceTree.module.css";

export const SliderView = memo(({ data, selected }: NodeProps) => {
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

    // Extract value and config from state
    const value = typeof state === "number" ? state : state?.value ?? 0;
    const min = state?.min ?? 0;
    const max = state?.max ?? 100;
    const step = state?.step ?? 1;
    const unit = state?.unit ?? "";

    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div
            className={`bg-white border-2 rounded-lg shadow-lg min-w-[320px] ${
                selected
                    ? "border-purple-500 ring-2 ring-purple-300"
                    : "border-purple-400"
            } ${isFlashing ? styles.flash : ""}`}
        >
            {/* Connection handles */}
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-purple-500"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className="!bg-purple-500"
            />

            {/* Content */}
            <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">{name}</span>
                    <span className="text-3xl font-bold text-purple-600">
                        {value}
                        {unit}
                    </span>
                </div>

                {/* Slider */}
                <div className="relative">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => {
                            const newValue = Number(e.target.value);
                            // If state is just a number, send number
                            if (state === newValue) return;

                            if (typeof state === "number") {
                                gadget.receive(newValue);
                            } // If state is object, preserve other properties
                            else {
                                gadget.receive({ ...state, value: newValue });
                            }
                        }}
                        className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                            background:
                                `linear-gradient(to right, #a855f7 0%, #a855f7 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
                        }}
                    />
                </div>

                {/* Min/Max labels */}
                <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>{min}{unit}</span>
                    <span>{max}{unit}</span>
                </div>

                <div className="text-xs text-gray-400 font-mono truncate text-center">
                    {gadget.pkg}/{gadget.name}
                </div>
            </div>

            <style jsx>
                {`
                .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #a855f7;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #a855f7;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
            `}
            </style>
        </div>
    );
});

SliderView.displayName = "SliderView";
