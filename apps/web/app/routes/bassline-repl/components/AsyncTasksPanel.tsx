import { Activity, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

export interface AsyncTask {
    id: string;
    name: string;
    status: "pending" | "complete" | "error" | "cancelled";
    startTime: number;
    endTime?: number;
    duration?: number;
}

interface AsyncTasksPanelProps {
    tasks: AsyncTask[];
    onClearCompleted?: () => void;
}

export function AsyncTasksPanel({ tasks, onClearCompleted }: AsyncTasksPanelProps) {
    const [filter, setFilter] = useState<"all" | "pending" | "complete" | "error">("all");
    const [isCollapsed, setIsCollapsed] = useState(false);

    const filteredTasks = tasks.filter((task) => {
        if (filter === "all") return true;
        return task.status === filter;
    });

    const stats = {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === "pending").length,
        complete: tasks.filter((t) => t.status === "complete").length,
        error: tasks.filter((t) => t.status === "error").length,
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    const getElapsedTime = (startTime: number, endTime?: number) => {
        const now = endTime || Date.now();
        return now - startTime;
    };

    return (
        <div className="border-b bg-white">
            {/* Header */}
            <div
                className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-slate-50"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-violet-600" />
                    <h3 className="font-semibold text-sm">Async Tasks</h3>
                    {stats.pending > 0 && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            {stats.pending} running
                        </span>
                    )}
                </div>
                <button className="text-slate-400 hover:text-slate-600">
                    {isCollapsed ? "▶" : "▼"}
                </button>
            </div>

            {!isCollapsed && (
                <>
                    {/* Filter tabs */}
                    <div className="px-4 py-2 border-b bg-slate-50 flex items-center gap-2 text-xs">
                        <button
                            onClick={() => setFilter("all")}
                            className={`px-2 py-1 rounded ${
                                filter === "all"
                                    ? "bg-white border shadow-sm"
                                    : "hover:bg-white/50"
                            }`}
                        >
                            All ({stats.total})
                        </button>
                        <button
                            onClick={() => setFilter("pending")}
                            className={`px-2 py-1 rounded ${
                                filter === "pending"
                                    ? "bg-white border shadow-sm"
                                    : "hover:bg-white/50"
                            }`}
                        >
                            Pending ({stats.pending})
                        </button>
                        <button
                            onClick={() => setFilter("complete")}
                            className={`px-2 py-1 rounded ${
                                filter === "complete"
                                    ? "bg-white border shadow-sm"
                                    : "hover:bg-white/50"
                            }`}
                        >
                            Complete ({stats.complete})
                        </button>
                        <button
                            onClick={() => setFilter("error")}
                            className={`px-2 py-1 rounded ${
                                filter === "error"
                                    ? "bg-white border shadow-sm"
                                    : "hover:bg-white/50"
                            }`}
                        >
                            Error ({stats.error})
                        </button>

                        {stats.complete > 0 && onClearCompleted && (
                            <button
                                onClick={onClearCompleted}
                                className="ml-auto text-slate-600 hover:text-slate-900"
                            >
                                Clear completed
                            </button>
                        )}
                    </div>

                    {/* Task list */}
                    <div className="max-h-96 overflow-auto">
                        {filteredTasks.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                                {filter === "all" ? (
                                    <>
                                        <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        <p className="mb-2">No async tasks yet</p>
                                        <p className="text-xs text-slate-400">
                                            Try: <code className="bg-slate-100 px-1 rounded">task: async [+ 1 2]</code>
                                        </p>
                                    </>
                                ) : (
                                    <p>No {filter} tasks</p>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredTasks.map((task) => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        elapsed={getElapsedTime(task.startTime, task.endTime)}
                                        formatDuration={formatDuration}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function TaskItem({
    task,
    elapsed,
    formatDuration,
}: {
    task: AsyncTask;
    elapsed: number;
    formatDuration: (ms: number) => string;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getStatusBadge = () => {
        switch (task.status) {
            case "pending":
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded border border-yellow-300">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Pending
                    </span>
                );
            case "complete":
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded border border-green-300">
                        <CheckCircle className="w-3 h-3" />
                        Complete
                    </span>
                );
            case "error":
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs rounded border border-red-300">
                        <XCircle className="w-3 h-3" />
                        Error
                    </span>
                );
            case "cancelled":
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border border-slate-300">
                        Cancelled
                    </span>
                );
        }
    };

    return (
        <div
            className="px-4 py-3 hover:bg-slate-50 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge()}
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {formatDuration(elapsed)}
                        </span>
                    </div>
                    <p className="text-sm font-mono text-slate-700 truncate">{task.name}</p>
                    {isExpanded && (
                        <div className="mt-2 text-xs text-slate-500 space-y-1">
                            <p>ID: {task.id}</p>
                            <p>Started: {new Date(task.startTime).toLocaleTimeString()}</p>
                            {task.endTime && (
                                <p>Ended: {new Date(task.endTime).toLocaleTimeString()}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
