import { useMemo, useState } from "react";
import type { Route } from "./+types/route";
import { ReplInput } from "./components/ReplInput";
import { ReplOutput } from "./components/ReplOutput";
import { createRepl } from "@bassline/lang/repl";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Bassline REPL" },
        { name: "description", content: "Interactive Bassline language REPL" },
    ];
}

interface OutputEntry {
    code: string;
    result: { ok: boolean; value?: any; error?: string };
}

export default function BasslineRepl() {
    const [history, setHistory] = useState<OutputEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Create REPL instance once to preserve context across renders
    const repl = useMemo(() => createRepl(), []);

    const handleExecute = (code: string) => {
        const result = repl.eval(code);
        setHistory([...history, { code, result }]);
        setHistoryIndex(-1); // Reset history navigation
        return result;
    };

    const handleNavigateHistory = (direction: "up" | "down") => {
        if (history.length === 0) return null;

        let newIndex: number;
        if (direction === "up") {
            newIndex = historyIndex === -1
                ? history.length - 1
                : Math.max(0, historyIndex - 1);
        } else {
            newIndex = historyIndex === -1 ? -1 : Math.min(history.length - 1, historyIndex + 1);
            if (newIndex === history.length - 1 && historyIndex === history.length - 1) {
                newIndex = -1; // Wrap to empty
            }
        }

        setHistoryIndex(newIndex);
        return newIndex === -1 ? "" : history[newIndex].code;
    };

    const handleClear = () => {
        setHistory([]);
        setHistoryIndex(-1);
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50">
            {/* Header */}
            <div className="border-b bg-white px-6 py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Bassline REPL</h1>
                        <p className="text-sm text-slate-600">
                            Interactive language environment
                        </p>
                    </div>
                    <button
                        onClick={handleClear}
                        className="text-sm px-3 py-1 border rounded hover:bg-slate-50"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Output area */}
                <div className="flex-1 overflow-auto px-6 py-4">
                    <ReplOutput history={history} />
                </div>

                {/* Input area */}
                <div className="border-t bg-white px-6 py-4">
                    <ReplInput
                        onExecute={handleExecute}
                        onNavigateHistory={handleNavigateHistory}
                    />
                </div>
            </div>
        </div>
    );
}
