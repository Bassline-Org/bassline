import { useState } from "react";
import { Input } from "~/components/ui/input";
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="flex gap-2 items-center">
            <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="query where { ?person age ?age * }"
                className="flex-1 font-mono text-sm"
            />
            <Button onClick={handleSubmit} variant="default" size="sm">
                Run
            </Button>
        </div>
    );
}
