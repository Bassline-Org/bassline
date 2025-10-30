import { useEffect, useRef, useState } from "react";
import { createSpreadsheetRuntime } from "~/lib/SpreadsheetRuntime";
import { SpreadsheetView } from "~/components/SpreadsheetView";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { TYPES as t } from "@bassline/parser";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface ResultEntry {
    code: string;
    result: any;
    error?: string;
}

const EXAMPLE_CODE = `sheet: spreadsheet [
    Price: 100
    TaxRate: 10
    Tax: multiply Price TaxRate
    Total: add Price Tax
    Discount: 5
    FinalTotal: subtract Total Discount
]

print "Initial values:"
values: get-all-values sheet
print values`;

export default function SpreadsheetReplRoute() {
    const [code, setCode] = useState(EXAMPLE_CODE);
    const [results, setResults] = useState<ResultEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [currentSpreadsheet, setCurrentSpreadsheet] = useState<any>(null);
    const runtimeRef = useRef(createSpreadsheetRuntime());
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleExecute = () => {
        if (!code.trim()) return;

        try {
            const result = runtimeRef.current.evaluate(code);

            // Check if result is a spreadsheet
            if (result && result.type === "SPREADSHEET!") {
                setCurrentSpreadsheet(result.value);
            }

            // Try to find spreadsheet in context variables
            // Look for variables that might be spreadsheets
            const context = runtimeRef.current.context;
            for (const [, value] of Object.entries(context)) {
                if (
                    value && typeof value === "object" &&
                    value.type === "SPREADSHEET!"
                ) {
                    setCurrentSpreadsheet(value.value);
                    break;
                }
            }

            // Also check if code assigns to a variable (heuristic)
            const match = code.match(/(\w+):\s*spreadsheet\s*\[/);
            if (match && context && typeof context === "object") {
                const varName = match[1].toUpperCase();
                const sheetVar = (context as Record<string, any>)[varName];
                if (sheetVar && sheetVar.type === "SPREADSHEET!") {
                    setCurrentSpreadsheet(sheetVar.value);
                }
            }

            setResults([...results, { code, result }]);
            setCode("");
            setHistoryIndex(-1);
        } catch (error: any) {
            setResults([
                ...results,
                {
                    code,
                    result: null,
                    error: error.message || String(error),
                },
            ]);
            setCode("");
            setHistoryIndex(-1);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Execute on Ctrl+Enter or Cmd+Enter
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleExecute();
        }
        // Navigate history with arrow keys
        if (e.key === "ArrowUp" && results.length > 0) {
            e.preventDefault();
            const newIndex = Math.min(historyIndex + 1, results.length - 1);
            setHistoryIndex(newIndex);
            const historyItem = results[results.length - 1 - newIndex];
            if (historyItem) {
                setCode(historyItem.code);
            }
        }
        if (e.key === "ArrowDown" && historyIndex > 0) {
            e.preventDefault();
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            const historyItem = results[results.length - 1 - newIndex];
            if (historyItem) {
                setCode(historyItem.code);
            }
        }
        if (e.key === "ArrowDown" && historyIndex === 0) {
            e.preventDefault();
            setHistoryIndex(-1);
            setCode("");
        }
    };

    // Try to extract spreadsheet from results on mount
    useEffect(() => {
        // Look for spreadsheet in recent results
        for (let i = results.length - 1; i >= 0; i--) {
            const entry = results[i];
            if (entry && entry.result && entry.result.type === "SPREADSHEET!") {
                setCurrentSpreadsheet(entry.result.value);
                break;
            }
        }
    }, [results]);

    return (
        <div className="flex h-screen max-h-screen">
            {/* Left Panel - Code Editor */}
            <div className="w-1/2 min-w-[500px] flex flex-col border-r bg-background">
                <div className="border-b p-4 bg-background">
                    <h2 className="text-lg font-semibold">Spreadsheet REPL</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Write Bassline code to create and manipulate
                        spreadsheets
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="border-b p-2 bg-background/50">
                    <div className="flex flex-wrap gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCode(EXAMPLE_CODE)}
                            className="text-xs"
                        >
                            Load Example
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCode("")}
                            className="text-xs"
                        >
                            Clear
                        </Button>
                    </div>
                </div>

                {/* Code Editor */}
                <div className="flex-1 p-4">
                    <div className="h-full flex flex-col gap-4">
                        <div className="flex-1">
                            <Textarea
                                ref={textareaRef}
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter Bassline code..."
                                className="h-full resize-none font-mono text-sm bg-background"
                                spellCheck={false}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleExecute}
                                className="flex-1"
                                disabled={!code.trim()}
                            >
                                Execute (Ctrl+Enter)
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setResults([])}
                                disabled={results.length === 0}
                            >
                                Clear History
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Use ↑/↓ to navigate history • Ctrl+Enter to execute
                        </div>
                    </div>
                </div>

                {/* Results History */}
                <div className="border-t flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-4">
                            {results.map((entry, index) => {
                                if (!entry) return null;
                                return (
                                    <Card key={index}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <Badge
                                                    variant="outline"
                                                    className="font-mono text-xs"
                                                >
                                                    {entry.code.substring(
                                                        0,
                                                        50,
                                                    )}
                                                    {entry.code.length > 50
                                                        ? "..."
                                                        : ""}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    #{index + 1}
                                                </span>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {entry.error
                                                ? (
                                                    <Alert variant="destructive">
                                                        <AlertDescription>
                                                            {entry.error}
                                                        </AlertDescription>
                                                    </Alert>
                                                )
                                                : (
                                                    <div className="font-mono text-sm">
                                                        {entry.result?.type ===
                                                                "SPREADSHEET!"
                                                            ? (
                                                                <Badge>
                                                                    Spreadsheet
                                                                </Badge>
                                                            )
                                                            : entry.result
                                                                    ?.type ===
                                                                    t.number
                                                            ? (
                                                                entry.result
                                                                    .value
                                                            )
                                                            : entry.result
                                                                    ?.type ===
                                                                    t.string
                                                            ? (
                                                                `"${entry.result.value}"`
                                                            )
                                                            : (
                                                                JSON.stringify(
                                                                    entry
                                                                        .result,
                                                                    null,
                                                                    2,
                                                                )
                                                            )}
                                                    </div>
                                                )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                            {results.length === 0 && (
                                <div className="text-center text-muted-foreground py-8">
                                    <p>Press Ctrl+Enter to execute code</p>
                                    <p className="text-sm mt-2">
                                        Try the example spreadsheet code above
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Right Panel - Spreadsheet View */}
            <div className="flex-1 overflow-auto bg-muted/30">
                <div className="p-6">
                    <SpreadsheetView spreadsheet={currentSpreadsheet} />
                </div>
            </div>
        </div>
    );
}
