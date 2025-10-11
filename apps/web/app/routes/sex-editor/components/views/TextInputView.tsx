import { memo, useEffect, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { BothPorts } from "./viewUtils";

export const TextInputView = memo(({ data, selected }: NodeProps) => {
    const { name, gadget } = data;
    const state = gadget.useCurrent();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Extract text value from state
    const value = typeof state === "string" ? state : String(state ?? "");

    const [inputValue, setInputValue] = useState(value);

    // Auto-resize textarea to fit content
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [inputValue]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
    };

    const handleBlur = () => {
        gadget.receive(inputValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl/Cmd + Enter to submit
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            gadget.receive(inputValue);
            (e.target as HTMLTextAreaElement).blur();
        }
    };

    return (
        <div
            className={`bg-white border-2 rounded-lg shadow-lg min-w-[320px] max-w-[500px] ${
                selected
                    ? "border-teal-500 ring-2 ring-teal-300"
                    : "border-teal-400"
            }`}
        >
            <BothPorts />

            {/* Header */}
            <div className="bg-teal-100 px-3 py-2 border-b border-teal-300 rounded-t-lg">
                <div className="text-sm font-medium text-teal-700">{name || "text"}</div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-2">
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter text..."
                    className="w-full px-3 py-2 text-sm border-2 border-teal-200 rounded-lg focus:border-teal-500 focus:outline-none resize-none font-mono"
                    rows={1}
                    style={{ minHeight: "60px" }}
                />

                <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{inputValue.length} characters</span>
                    <span className="text-gray-400">⌘↵ to submit</span>
                </div>

                <div className="text-xs text-gray-400 font-mono truncate text-center">
                    {gadget.pkg}/{gadget.name}
                </div>
            </div>
        </div>
    );
});

TextInputView.displayName = "TextInputView";
