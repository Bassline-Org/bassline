import { Button } from "~/components/ui/button";
import type { HistoryEntry } from "../types";

interface HistoryPanelProps {
    history: HistoryEntry[] | null;
    onClear: () => void;
    onSelectEntry: (actions: string) => void;
}

export function HistoryPanel({
    history,
    onClear,
    onSelectEntry,
}: HistoryPanelProps) {
    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                    Execution History
                </h3>
                <Button size="sm" variant="outline" onClick={onClear}>
                    Clear
                </Button>
            </div>
            {!history || history.length === 0 ? (
                <div className="text-sm text-gray-500">
                    No actions executed yet
                </div>
            ) : (
                <div className="space-y-2">
                    {[...history].reverse().map((entry, idx) => {
                        const time = new Date(
                            entry.timestamp,
                        ).toLocaleTimeString();
                        const actionStr = JSON.stringify(
                            entry.actions,
                            null,
                            2,
                        );
                        return (
                            <div
                                key={idx}
                                className="border rounded p-2 hover:bg-gray-50 cursor-pointer"
                                onClick={() => onSelectEntry(actionStr)}
                            >
                                <div className="text-xs text-gray-500 mb-1">
                                    {time}
                                </div>
                                <pre className="text-xs font-mono overflow-auto">
                                    {actionStr}
                                </pre>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
