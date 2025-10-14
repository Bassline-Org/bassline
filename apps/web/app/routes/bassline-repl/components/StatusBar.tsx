import { Activity, Globe, Zap } from "lucide-react";
import type { AsyncTask } from "./AsyncTasksPanel";
import type { RemotePeer } from "./RemotePeersPanel";

interface StatusBarProps {
    tasks: AsyncTask[];
    peers: RemotePeer[];
    onToggleTasks?: () => void;
    onTogglePeers?: () => void;
}

export function StatusBar({ tasks, peers, onToggleTasks, onTogglePeers }: StatusBarProps) {
    const pendingTasks = tasks.filter((t) => t.status === "pending").length;
    const connectedPeers = peers.filter((p) => p.status === "connected").length;

    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b text-xs">
            {/* Tasks indicator */}
            <button
                onClick={onToggleTasks}
                className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/70 transition-colors ${
                    pendingTasks > 0
                        ? "text-yellow-700 bg-yellow-100/50"
                        : tasks.length > 0
                        ? "text-green-700 bg-green-100/50"
                        : "text-slate-600"
                }`}
                title={`${tasks.length} async tasks (${pendingTasks} pending)`}
            >
                <Activity className="w-3.5 h-3.5" />
                <span className="font-medium">
                    {pendingTasks > 0 ? (
                        <>
                            <span className="animate-pulse">{pendingTasks}</span> running
                        </>
                    ) : tasks.length > 0 ? (
                        `${tasks.length} tasks`
                    ) : (
                        "No tasks"
                    )}
                </span>
            </button>

            {/* Peers indicator */}
            <button
                onClick={onTogglePeers}
                className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/70 transition-colors ${
                    connectedPeers > 0
                        ? "text-emerald-700 bg-emerald-100/50"
                        : "text-slate-600"
                }`}
                title={`${connectedPeers} peers connected`}
            >
                <Globe className="w-3.5 h-3.5" />
                <span className="font-medium">
                    {connectedPeers > 0 ? `${connectedPeers} peers` : "No peers"}
                </span>
            </button>

            {/* Runtime indicator */}
            <div
                className="flex items-center gap-1.5 px-2 py-1 text-violet-700 bg-violet-100/50 rounded"
                title="Your runtime"
            >
                <Zap className="w-3.5 h-3.5" />
                <span className="font-medium">Browser REPL</span>
            </div>

            {/* Keyboard hint */}
            <div className="ml-auto text-slate-500">
                <kbd className="px-1 py-0.5 text-[10px] border rounded bg-white">Cmd+K</kbd>{" "}
                to toggle panels
            </div>
        </div>
    );
}
