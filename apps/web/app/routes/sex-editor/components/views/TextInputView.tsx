import { memo, useEffect, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";

export const TextInputView = memo(({ data, selected }: NodeProps) => {
    const { name, gadget } = data;
    const state = gadget.useCurrent();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Extract text value from state
    const value = typeof state === "string" ? state : String(state ?? "");

    const [inputValue, setInputValue] = useState(value);

    // Sync input value when gadget state changes externally
    useEffect(() => {
        setInputValue(value);
    }, [value]);

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
        </div>
    );
});

TextInputView.displayName = "TextInputView";
