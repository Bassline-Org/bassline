import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Route } from "./+types/route";
import { ReplInput } from "./components/ReplInput";
import { ReplOutput } from "./components/ReplOutput";
import { AsyncTasksPanel, type AsyncTask } from "./components/AsyncTasksPanel";
import { RemotePeersPanel, type RemotePeer } from "./components/RemotePeersPanel";
import { StatusBar } from "./components/StatusBar";
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
    const [asyncTasks, setAsyncTasks] = useState<AsyncTask[]>([]);
    const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
    const [showSidebar, setShowSidebar] = useState(true);
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

    // Poll async tasks and remote peers
    useEffect(() => {
        const pollData = async () => {
            try {
                console.log("[Polling] Starting poll cycle...");

                // Poll async tasks
                const tasksResult = await repl.eval("keys ASYNC_TASKS");
                console.log("[Polling] ASYNC_TASKS keys result:", tasksResult);
                if (tasksResult.ok && tasksResult.value?.items) {
                    // items are Str objects with .value property
                    const taskIds = tasksResult.value.items.map((item: any) => item.value);
                    console.log("[Polling] Found task IDs:", taskIds);
                    const tasks: AsyncTask[] = [];

                    for (const taskId of taskIds) {
                        const taskResult = await repl.eval(`get ASYNC_TASKS "${taskId}"`);
                        console.log(`[Polling] Task ${taskId} data:`, taskResult);
                        if (taskResult.ok && taskResult.value) {
                            const id = taskResult.value.get?.(Symbol.for("ID"))?.value || taskId;
                            const name = taskResult.value.get?.(Symbol.for("NAME"))?.value || "Unknown";
                            const status = taskResult.value.get?.(Symbol.for("STATUS"))?.value || "pending";
                            const startTime = taskResult.value.get?.(Symbol.for("STARTTIME"))?.value || Date.now();
                            const endTime = taskResult.value.get?.(Symbol.for("ENDTIME"))?.value;
                            const duration = taskResult.value.get?.(Symbol.for("DURATION"))?.value;

                            tasks.push({ id, name, status, startTime, endTime, duration });
                        }
                    }

                    console.log("[Polling] Setting asyncTasks state:", tasks);
                    setAsyncTasks(tasks);
                }

                // Poll remote peers
                const peersResult = await repl.eval("keys REMOTE_PEERS");
                console.log("[Polling] REMOTE_PEERS keys result:", peersResult);
                if (peersResult.ok && peersResult.value?.items) {
                    // items are Str objects with .value property
                    const peerUrls = peersResult.value.items.map((item: any) => item.value);
                    console.log("[Polling] Found peer URLs:", peerUrls);
                    const peers: RemotePeer[] = [];

                    for (const url of peerUrls) {
                        const peerResult = await repl.eval(`get REMOTE_PEERS "${url}"`);
                        console.log(`[Polling] Peer ${url} data:`, peerResult);
                        if (peerResult.ok && peerResult.value) {
                            // peerResult.value is a Context, use .get() method
                            const statusValue = peerResult.value.get("status");
                            const connectedAtValue = peerResult.value.get("connected-at");

                            const status = statusValue?.value || "unknown";
                            const connectedAt = connectedAtValue?.value;

                            peers.push({ url, status, connectedAt });
                        }
                    }

                    console.log("[Polling] Setting remotePeers state:", peers);
                    setRemotePeers(peers);
                }
            } catch (error) {
                console.error("[Polling] Error during poll:", error);
            }
        };

        // Poll immediately and then every 500ms
        pollData();
        const interval = setInterval(pollData, 500);

        return () => clearInterval(interval);
    }, [repl]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+K to toggle sidebar
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setShowSidebar((prev) => !prev);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

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

    const handleConnect = useCallback(
        async (url: string) => {
            const code = `remote connect "${url}"`;
            const result = await repl.eval(code);
            if (result.ok) {
                setHistory([...history, { code, result }]);
            } else {
                throw new Error(result.error || "Connection failed");
            }
        },
        [repl, history]
    );

    const handleDisconnect = useCallback(
        async (url: string) => {
            // Find the peer handle variable
            const peerResult = await repl.eval(`get REMOTE_PEERS "${url}"`);
            if (peerResult.ok) {
                const code = `remote disconnect (get REMOTE_PEERS "${url}")`;
                await repl.eval(code);
                setHistory([...history, { code, result: { ok: true } }]);
            }
        },
        [repl, history]
    );

    const handlePing = useCallback(
        async (url: string) => {
            // Simple ping by getting the peer status
            const code = `status (get REMOTE_PEERS "${url}")`;
            const result = await repl.eval(code);
            if (result.ok) {
                setHistory([...history, { code, result }]);
            }
        },
        [repl, history]
    );

    return (
        <div className="h-screen flex bg-slate-50">
            {/* Main REPL area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="border-b bg-white px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">Bassline REPL</h1>
                            <p className="text-sm text-slate-600">
                                Interactive distributed runtime
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

                {/* Status bar */}
                <StatusBar
                    tasks={asyncTasks}
                    peers={remotePeers}
                    onToggleTasks={() => setShowSidebar((prev) => !prev)}
                    onTogglePeers={() => setShowSidebar((prev) => !prev)}
                />

                {/* Main content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Output area */}
                    <div ref={outputRef} className="flex-1 overflow-auto px-6 py-4">
                        <ReplOutput
                            history={history}
                            repl={repl}
                            onViewAction={() => {
                                // Force re-render by updating state
                                setHistory([...history]);
                            }}
                        />
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

            {/* Right sidebar */}
            {showSidebar && (
                <div className="w-96 border-l bg-white overflow-auto flex-shrink-0">
                    <AsyncTasksPanel tasks={asyncTasks} />
                    <RemotePeersPanel
                        peers={remotePeers}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        onPing={handlePing}
                    />
                </div>
            )}
        </div>
    );
}
