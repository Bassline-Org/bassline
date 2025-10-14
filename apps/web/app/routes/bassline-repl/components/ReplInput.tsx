import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";

interface ReplInputProps {
    onExecute: (code: string) => { ok: boolean; value?: any; error?: string };
    onNavigateHistory: (direction: "up" | "down") => string | null;
}

export function ReplInput({ onExecute, onNavigateHistory }: ReplInputProps) {
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleExecute = () => {
        if (!input.trim()) return;

        onExecute(input);
        setInput("");

        // Focus back on textarea
        textareaRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Cmd+Enter or Ctrl+Enter to execute
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleExecute();
            return;
        }

        // Up/Down to navigate history (only when textarea is on first/last line)
        const textarea = e.currentTarget;
        const { selectionStart, value } = textarea;
        const currentLine = value.substring(0, selectionStart).split("\n").length - 1;
        const totalLines = value.split("\n").length - 1;

        if (e.key === "ArrowUp" && currentLine === 0 && !e.shiftKey) {
            e.preventDefault();
            const historicalCode = onNavigateHistory("up");
            if (historicalCode !== null) {
                setInput(historicalCode);
                // Set cursor to end
                setTimeout(() => {
                    const len = historicalCode.length;
                    textarea.setSelectionRange(len, len);
                }, 0);
            }
        } else if (e.key === "ArrowDown" && currentLine === totalLines && !e.shiftKey) {
            e.preventDefault();
            const historicalCode = onNavigateHistory("down");
            if (historicalCode !== null) {
                setInput(historicalCode);
                // Set cursor to end
                setTimeout(() => {
                    const len = historicalCode.length;
                    textarea.setSelectionRange(len, len);
                }, 0);
            }
        }
    };

    // Auto-focus on mount
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    return (
        <div className="space-y-2">
            <div className="text-xs text-slate-500">
                Press <kbd className="px-1 py-0.5 border rounded bg-slate-100">Cmd+Enter</kbd> to
                execute
            </div>
            <div className="flex gap-2">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type Bassline code here..."
                    className="flex-1 px-3 py-2 border rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                    rows={3}
                />
                <Button
                    onClick={handleExecute}
                    disabled={!input.trim()}
                    className="self-start"
                >
                    Execute
                </Button>
            </div>
        </div>
    );
}
