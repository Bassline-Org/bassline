import { useEffect, useMemo, useRef, useState } from "react";
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
    const [history, setHistory] = useState<OutputEntry[]>(() => {
        // Load history from localStorage on mount
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("bassline-repl-history");
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch {
                    return [];
                }
            }
        }
        return [];
    });
    const [historyIndex, setHistoryIndex] = useState(-1);
    const outputRef = useRef<HTMLDivElement>(null);

    // Create REPL instance once to preserve context across renders
    const repl = useMemo(() => {
        const r = createRepl();
        // Restore context from saved history
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("bassline-repl-history");
            if (saved) {
                try {
                    const savedHistory = JSON.parse(saved);
                    // Re-execute all successful evaluations to restore context
                    savedHistory.forEach((entry: OutputEntry) => {
                        if (entry.result.ok) {
                            r.eval(entry.code);
                        }
                    });
                } catch {
                    // Ignore errors during restoration
                }
            }
        }
        return r;
    }, []);

    // Save history to localStorage when it changes
    useEffect(() => {
        if (typeof window !== "undefined" && history.length > 0) {
            localStorage.setItem("bassline-repl-history", JSON.stringify(history));
        }
    }, [history]);

    // Auto-scroll to bottom when history changes
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [history]);

    const handleExecute = async (code: string) => {
        const result = await repl.eval(code);
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
        if (typeof window !== "undefined") {
            localStorage.removeItem("bassline-repl-history");
        }
    };

    const handleExport = () => {
        // Export history as .bl file
        const code = history
            .filter((entry) => entry.result.ok)
            .map((entry) => entry.code)
            .join("\n\n");

        const blob = new Blob([code], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bassline-session-${Date.now()}.bl`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".bl";
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const code = e.target?.result as string;
                if (!code) return;

                // Execute the loaded code
                const result = await repl.eval(code);
                setHistory([...history, { code, result }]);
            };
            reader.readAsText(file);
        };
        input.click();
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
                    <div className="flex gap-2">
                        <button
                            onClick={handleImport}
                            className="text-sm px-3 py-1 border rounded hover:bg-slate-50"
                            title="Import session from .bl file"
                        >
                            Import
                        </button>
                        <button
                            onClick={handleExport}
                            className="text-sm px-3 py-1 border rounded hover:bg-slate-50"
                            disabled={history.length === 0}
                            title="Export session as .bl file"
                        >
                            Export
                        </button>
                        <button
                            onClick={handleClear}
                            className="text-sm px-3 py-1 border rounded hover:bg-slate-50"
                            title="Clear history and reset session"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Output area */}
                <div ref={outputRef} className="flex-1 overflow-auto px-6 py-4">
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
