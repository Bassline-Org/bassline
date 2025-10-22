import { useState, useRef } from "react";
import { RuntimeProvider, useEvaluate } from "~/lib/RuntimeProvider";
import { DisplayValue } from "~/lib/BasicView";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";

interface ResultEntry {
    code: string;
    result: any;
}

function ReplInner() {
    const [code, setCode] = useState("example-view");
    const [results, setResults] = useState<ResultEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const evaluate = useEvaluate();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleExecute = () => {
        if (code.trim()) {
            const result = evaluate(code);
            console.log("Result", result);
            setResults([...results, { code, result }]);
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

    return (
        <div className="flex h-screen max-h-screen">
            {/* Results Panel */}
            <div className="flex-1 border-r bg-background">
                <div className="border-b p-4">
                    <h2 className="text-lg font-semibold">Output</h2>
                </div>
                <ScrollArea className="h-[calc(100vh-60px)]">
                    <div className="p-4 space-y-4">
                        {results.map((entry, index) => (
                            <Card key={index}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {entry.code}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            #{index + 1}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <DisplayValue value={entry.result} />
                                </CardContent>
                            </Card>
                        ))}
                        {results.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                <p>Press Ctrl+Enter to execute code</p>
                                <p className="text-sm mt-2">
                                    Try typing{" "}
                                    <code className="px-1 py-0.5 bg-muted rounded">
                                        example-view
                                    </code>
                                </p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Input Panel */}
            <div className="w-1/3 min-w-[400px] flex flex-col bg-muted/30">
                <div className="border-b p-4 bg-background">
                    <h2 className="text-lg font-semibold">Bassline REPL</h2>
                </div>
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
                                Clear
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Use ↑/↓ to navigate history • Ctrl+Enter to execute
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ReplRoute() {
    return (
        <RuntimeProvider>
            <ReplInner />
        </RuntimeProvider>
    );
}