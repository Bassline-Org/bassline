import { useState } from "react";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";

interface ReplInputProps {
    onExecute: (input: string) => void;
}

export function ReplInput({ onExecute }: ReplInputProps) {
    const [input, setInput] = useState("");

    const handleSubmit = () => {
        if (!input.trim()) return;
        onExecute(input);
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === "Tab") {
            e.preventDefault();
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const spaces = "    "; // 4 spaces

            // Insert 4 spaces at cursor position
            const newValue = input.substring(0, start) + spaces + input.substring(end);
            setInput(newValue);

            // Move cursor after the inserted spaces
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
            }, 0);
        }
    };

    return (
        <div className="flex gap-2 items-start">
            <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="query where { ?person age ?age * }&#x0a;&#x0a;Press Cmd+Enter (or Ctrl+Enter) to run"
                className="flex-1 font-mono text-sm min-h-[60px]"
                rows={3}
            />
            <Button onClick={handleSubmit} variant="default" size="sm">
                Run
            </Button>
        </div>
    );
}
