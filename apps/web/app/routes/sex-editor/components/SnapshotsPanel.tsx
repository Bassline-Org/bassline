import { Button } from "~/components/ui/button";

interface Snapshot {
    label: string;
    timestamp: number;
    actions: any[];
}

interface SnapshotsPanelProps {
    snapshots: Record<string, any[]>;
    onRestore: (label: string) => void;
    onDelete: (label: string) => void;
}

export function SnapshotsPanel({
    snapshots,
    onRestore,
    onDelete,
}: SnapshotsPanelProps) {
    const snapshotList = Object.entries(snapshots || {}).map(([label, actions]) => ({
        label,
        actions,
        timestamp: Date.now(), // TODO: Store actual timestamps
    }));

    if (snapshotList.length === 0) {
        return (
            <div className="p-4 text-gray-500 text-sm">
                No snapshots yet. Take a snapshot to save your workspace state.
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto p-4 space-y-2">
            {snapshotList.map((snapshot) => (
                <div
                    key={snapshot.label}
                    className="border rounded p-3 bg-white hover:bg-gray-50"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-mono text-sm font-semibold">
                            {snapshot.label}
                        </div>
                        <div className="text-xs text-gray-500">
                            {snapshot.actions.length} action{snapshot.actions.length !== 1 ? "s" : ""}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRestore(snapshot.label)}
                        >
                            Restore
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                if (
                                    confirm(
                                        `Delete snapshot "${snapshot.label}"?`,
                                    )
                                ) {
                                    onDelete(snapshot.label);
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
