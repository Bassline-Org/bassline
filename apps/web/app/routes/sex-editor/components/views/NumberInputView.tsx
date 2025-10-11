import { memo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { BothPorts } from "./viewUtils";

export const NumberInputView = memo(({ data, selected }: NodeProps) => {
    const { name, gadget } = data;
    const state = gadget.useCurrent();

    // Extract value and constraints from state
    const value = typeof state === "number" ? state : state?.value ?? 0;
    const min = state?.min;
    const max = state?.max;
    const step = state?.step ?? 1;
    const unit = state?.unit ?? "";

    const [inputValue, setInputValue] = useState(String(value));

    const handleChange = (newValue: number) => {
        // If state is just a number, send number
        if (typeof state === "number") {
            gadget.receive(newValue);
        }
        // If state is object, preserve other properties
        else if (state && typeof state === "object") {
            gadget.receive({ ...state, value: newValue });
        }
        // Otherwise send number
        else {
            gadget.receive(newValue);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleInputBlur = () => {
        const num = Number(inputValue);
        if (!isNaN(num)) {
            handleChange(num);
        } else {
            setInputValue(String(value));
        }
    };

    const handleIncrement = () => {
        const newValue = value + step;
        if (max === undefined || newValue <= max) {
            handleChange(newValue);
            setInputValue(String(newValue));
        }
    };

    const handleDecrement = () => {
        const newValue = value - step;
        if (min === undefined || newValue >= min) {
            handleChange(newValue);
            setInputValue(String(newValue));
        }
    };

    return (
        <div
            className={`bg-white border-2 rounded-lg shadow-lg min-w-[280px] ${
                selected
                    ? "border-indigo-500 ring-2 ring-indigo-300"
                    : "border-indigo-400"
            }`}
        >
            <BothPorts />

            {/* Header */}
            <div className="bg-indigo-100 px-3 py-2 border-b border-indigo-300 rounded-t-lg">
                <div className="text-sm font-medium text-indigo-700">{name || "number"}</div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Big number display */}
                <div className="text-center">
                    <div className="text-4xl font-bold text-indigo-600">
                        {value}{unit}
                    </div>
                </div>

                {/* Input with +/- buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDecrement}
                        disabled={min !== undefined && value <= min}
                        className="w-10 h-10 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xl transition-colors"
                    >
                        −
                    </button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onBlur={handleInputBlur}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleInputBlur();
                            }
                        }}
                        className="flex-1 px-3 py-2 text-center text-lg border-2 border-indigo-200 rounded-lg focus:border-indigo-500 focus:outline-none font-mono"
                    />
                    <button
                        onClick={handleIncrement}
                        disabled={max !== undefined && value >= max}
                        className="w-10 h-10 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xl transition-colors"
                    >
                        +
                    </button>
                </div>

                {/* Constraints display */}
                {(min !== undefined || max !== undefined) && (
                    <div className="flex justify-between text-xs text-gray-500 font-mono">
                        <span>{min !== undefined ? `min: ${min}` : ""}</span>
                        <span>{max !== undefined ? `max: ${max}` : ""}</span>
                    </div>
                )}

                <div className="text-xs text-gray-400 font-mono truncate text-center">
                    {gadget.pkg}/{gadget.name}
                </div>
            </div>
        </div>
    );
});

NumberInputView.displayName = "NumberInputView";
