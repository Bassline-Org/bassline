import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export const SliderView = memo(({ data }: NodeProps) => {
    const { gadget } = data as any;
    const state = gadget.useCurrent();

    // Extract value and config from state
    const value = typeof state === "number" ? state : state?.value ?? 0;
    const min = state?.min ?? 0;
    const max = state?.max ?? 100;
    const step = state?.step ?? 1;
    const unit = state?.unit ?? "";

    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="p-6 space-y-4">
            <div className="flex justify-end items-center">
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
