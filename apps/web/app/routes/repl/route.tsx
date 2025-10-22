import { useState, useRef, useEffect } from "react";
import { RuntimeProvider, useEvaluate, useRuntime } from "~/lib/RuntimeProvider";
import { DisplayValue } from "~/lib/BasicView";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import * as p from "@bassline/lang/prelude";

interface ResultEntry {
    code: string;
    result: any;
}

function ReplInner() {
    const [code, setCode] = useState("example-view");
    const [results, setResults] = useState<ResultEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [liveView, setLiveView] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("repl");
    const evaluate = useEvaluate();
    const runtime = useRuntime();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleExecute = () => {
        if (code.trim()) {
            const result = evaluate(code);
            console.log("Result", result);
            setResults([...results, { code, result }]);

            // If the result is a view context, set it as the live view
            if (result && result.is && result.is(p.ContextBase)) {
                const context = result as p.ContextBase;
                const type = context.get("type");
                if (type?.spelling === "view") {
                    setLiveView(result);
                    setActiveTab("view");
                }
            }

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

    // Load example-view on mount
    useEffect(() => {
        const exampleView = runtime.context.get("example-view");
        if (exampleView && exampleView.is && exampleView.is(p.ContextBase)) {
            const context = exampleView as p.ContextBase;
            const type = context.get("type");
            if (type?.spelling === "view") {
                setLiveView(exampleView);
            }
        }
    }, [runtime]);

    return (
        <div className="flex h-screen max-h-screen">
            {/* Left Panel - Output/View Tabs */}
            <div className="flex-1 border-r bg-background">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <div className="border-b px-4 pt-4">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="repl">REPL Output</TabsTrigger>
                            <TabsTrigger value="view">Live View</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="repl" className="flex-1 m-0">
                        <ScrollArea className="h-[calc(100vh-100px)]">
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
                    </TabsContent>

                    <TabsContent value="view" className="flex-1 m-0">
                        <ScrollArea className="h-[calc(100vh-100px)]">
                            <div className="p-6">
                                {liveView ? (
                                    <DisplayValue value={liveView} />
                                ) : (
                                    <div className="text-center text-muted-foreground py-8">
                                        <p>No view loaded</p>
                                        <p className="text-sm mt-2">
                                            Execute <code className="px-1 py-0.5 bg-muted rounded">example-view</code> to see the demo
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Input Panel */}
            <div className="w-1/3 min-w-[400px] flex flex-col bg-muted/30">
                <div className="border-b p-4 bg-background">
                    <h2 className="text-lg font-semibold">Bassline REPL</h2>
                </div>

                {/* Quick Actions */}
                <div className="border-b p-2 bg-background/50">
                    <div className="flex flex-wrap gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setCode("example-view");
                                handleExecute();
                            }}
                            className="text-xs"
                        >
                            Load Demo
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCode("words system")}
                            className="text-xs"
                        >
                            List Words
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCode("list-local")}
                            className="text-xs"
                        >
                            List Storage
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCode('save-local "test" "Hello from REPL!"')}
                            className="text-xs"
                        >
                            Test Save
                        </Button>
                    </div>
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