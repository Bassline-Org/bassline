/**
 * LayerListPanel - Interactive layer management panel
 *
 * Displays all layers with status badges showing:
 * - Staging state (clean/dirty)
 * - Current branch
 * - Commit count
 *
 * Allows adding and removing layers interactively.
 */

import { useState } from "react";
import {
    useLayeredControl,
    useLayers,
    useStaging,
    useCommits,
    useBranches
} from "../hooks/useLayeredControl.jsx";

export function LayerListPanel() {
    const lc = useLayeredControl();
    const layers = useLayers();
    const [newLayerName, setNewLayerName] = useState("");

    const handleAddLayer = () => {
        if (!newLayerName.trim()) {
            return;
        }

        try {
            lc.addLayer(newLayerName.trim());
            setNewLayerName("");
        } catch (err) {
            alert(`Failed to add layer: ${err.message}`);
        }
    };

    const handleRemoveLayer = (name) => {
        if (confirm(`Remove layer "${name}"? This cannot be undone.`)) {
            try {
                lc.removeLayer(name);
            } catch (err) {
                alert(`Failed to remove layer: ${err.message}`);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-card border rounded-lg">
            {/* Header */}
            <div className="border-b p-4">
                <h3 className="text-lg font-semibold">Layers</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    {layers.length} {layers.length === 1 ? "layer" : "layers"}
                </p>
            </div>

            {/* Layer List */}
            <div className="flex-1 overflow-y-auto p-2">
                {layers.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        No layers yet. Add one below to get started.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {layers.map((name) => (
                            <LayerItem
                                key={name}
                                name={name}
                                onRemove={() => handleRemoveLayer(name)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Add Layer Form */}
            <div className="border-t p-4">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newLayerName}
                        onChange={(e) => setNewLayerName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleAddLayer();
                            }
                        }}
                        placeholder="Layer name..."
                        className="flex-1 px-3 py-2 border rounded-md bg-background text-sm"
                    />
                    <button
                        onClick={handleAddLayer}
                        disabled={!newLayerName.trim()}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                        Add Layer
                    </button>
                </div>
            </div>
        </div>
    );
}

function LayerItem({ name, onRemove }) {
    const staging = useStaging(name);
    const commits = useCommits(name);
    const branches = useBranches(name);

    return (
        <div className="flex items-center justify-between p-3 border rounded-md hover:bg-accent/50 transition-colors">
            <div className="flex-1 min-w-0">
                {/* Layer Name */}
                <div className="font-medium text-sm truncate mb-1">{name}</div>

                {/* Status Badges */}
                <div className="flex gap-2 flex-wrap">
                    {/* Branch Badge */}
                    {branches.current && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {branches.current}
                        </span>
                    )}

                    {/* Staging Badge */}
                    {staging.hasChanges ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                            {staging.count} staged
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Clean
                        </span>
                    )}

                    {/* Commit Count Badge */}
                    {commits.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            {commits.length} {commits.length === 1 ? "commit" : "commits"}
                        </span>
                    )}
                </div>
            </div>

            {/* Remove Button */}
            <button
                onClick={onRemove}
                className="ml-3 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title={`Remove ${name}`}
            >
                Remove
            </button>
        </div>
    );
}
