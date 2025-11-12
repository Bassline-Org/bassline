/**
 * HistoryPanel - Interactive Git-style commit history visualization
 *
 * Features:
 * - Visual commit graph with React Flow
 * - Click commits to checkout or create branches
 * - Switch between branches
 * - Show current HEAD/branch state
 */

import { useState, useCallback, useMemo } from "react";
import {
    ReactFlow,
    Background,
    Controls,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    useLayeredControl,
    useCommits,
    useBranches,
} from "../hooks/useLayeredControl.jsx";
import { useWorkspace } from "../workspace/WorkspaceContext.jsx";

/**
 * Custom commit node component
 */
function CommitNode({ data }) {
    const { message, timestamp, quadCount, branches, isCurrent, isHead } = data;
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString();

    return (
        <div
            className={`px-4 py-3 rounded-lg border-2 bg-white shadow-md min-w-[200px] ${
                isCurrent
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
            }`}
        >
            {/* Branches pointing to this commit */}
            {branches && branches.length > 0 && (
                <div className="flex gap-1 mb-2">
                    {branches.map((branch) => (
                        <span
                            key={branch}
                            className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium"
                        >
                            {branch}
                        </span>
                    ))}
                </div>
            )}

            {/* HEAD indicator */}
            {isHead && (
                <div className="text-xs font-bold text-blue-600 mb-1">
                    → HEAD
                </div>
            )}

            {/* Commit message */}
            <div className="font-medium text-sm text-gray-900 mb-1">
                {message || "(no message)"}
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>{timeStr}</span>
                <span>•</span>
                <span>{quadCount} quads</span>
            </div>
        </div>
    );
}

const nodeTypes = {
    commit: CommitNode,
};

/**
 * Convert commits to React Flow nodes and edges
 */
function commitsToGraph(commits, branches, currentBranch, currentHead, refs) {
    if (!commits || commits.length === 0) {
        return { nodes: [], edges: [] };
    }

    // Build map of branch refs to commit hashes
    const branchCommits = {};
    if (refs) {
        Object.entries(refs).forEach(([refKey, commitHash]) => {
            const branchName = refKey.split("/").pop();
            if (!branchCommits[commitHash]) {
                branchCommits[commitHash] = [];
            }
            branchCommits[commitHash].push(branchName);
        });
    }

    // Create nodes
    const nodes = commits.map((commit, i) => {
        const commitHashStr = commit.hash.toString();
        const branchesHere = branchCommits[commit.hash] || [];

        return {
            id: commitHashStr,
            type: "commit",
            position: { x: 100, y: i * 120 },
            data: {
                message: commit.message,
                timestamp: commit.timestamp,
                quadCount: commit.quadCount,
                branches: branchesHere,
                isCurrent: commit.hash === currentHead,
                isHead: commit.hash === currentHead,
            },
        };
    });

    // Create a set of node IDs for fast lookup
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Create edges (parent connections)
    // Only create edges where both source and target nodes exist
    const edges = commits
        .filter((c) => c.parent !== null)
        .filter((c) => {
            const sourceId = c.hash.toString();
            const targetId = c.parent.toString();
            return nodeIds.has(sourceId) && nodeIds.has(targetId);
        })
        .map((c) => ({
            id: `${c.hash}-${c.parent}`,
            source: c.hash.toString(),
            target: c.parent.toString(),
            type: "smoothstep",
            animated: false,
            style: { stroke: "#6b7280", strokeWidth: 2 },
        }));

    return { nodes, edges };
}

/**
 * HistoryPanel Component
 */
export function HistoryPanel() {
    const { activeLayer } = useWorkspace();
    const lc = useLayeredControl();
    const commits = useCommits(activeLayer, 50); // Get last 50 commits
    const { branches = [], current: currentBranch } = useBranches(activeLayer);
    const [selectedCommit, setSelectedCommit] = useState(null);

    // Get current HEAD
    const layer = lc.getLayer(activeLayer);
    const currentHead = layer?.head;

    // Get refs for branch mapping
    const refs = lc.refs;

    // Convert commits to graph (computed, not state)
    const { nodes, edges } = useMemo(
        () => commitsToGraph(commits, branches, currentBranch, currentHead, refs),
        [commits, branches, currentBranch, currentHead, refs]
    );

    // Handle node click
    const onNodeClick = useCallback((event, node) => {
        setSelectedCommit(parseInt(node.id, 10));
    }, []);

    // Checkout commit (detached HEAD)
    const handleCheckout = useCallback(() => {
        if (!selectedCommit || !activeLayer) return;

        if (
            confirm(
                "Checkout this commit? You'll be in detached HEAD state (not on any branch)."
            )
        ) {
            lc.detachHead(activeLayer, selectedCommit);
            setSelectedCommit(null);
        }
    }, [lc, activeLayer, selectedCommit]);

    // Create branch from commit
    const handleCreateBranch = useCallback(() => {
        if (!selectedCommit || !activeLayer) return;

        const branchName = prompt("Branch name:");
        if (branchName && branchName.trim()) {
            try {
                lc.createBranch(activeLayer, branchName.trim(), selectedCommit);
                lc.switchBranch(activeLayer, branchName.trim());
                setSelectedCommit(null);
            } catch (err) {
                alert(`Failed to create branch: ${err.message}`);
            }
        }
    }, [lc, activeLayer, selectedCommit]);

    // Switch branch
    const handleSwitchBranch = useCallback(
        (branchName) => {
            if (!activeLayer) return;
            try {
                lc.switchBranch(activeLayer, branchName);
            } catch (err) {
                alert(`Failed to switch branch: ${err.message}`);
            }
        },
        [lc, activeLayer]
    );

    // Show message if no active layer
    if (!activeLayer) {
        return (
            <div className="h-full flex items-center justify-center bg-white text-gray-500">
                No active layer selected. Select a layer to view history.
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex-none px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                        History: {activeLayer}
                    </h3>
                    {currentBranch ? (
                        <span className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded">
                            On {currentBranch}
                        </span>
                    ) : (
                        <span className="text-sm px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                            Detached HEAD
                        </span>
                    )}
                </div>
            </div>

            {/* Branch List */}
            {branches.length > 0 && (
                <div className="flex-none px-4 py-2 border-b border-gray-200 bg-white">
                    <div className="flex gap-2 flex-wrap">
                        {branches.map((branch) => (
                            <button
                                key={branch}
                                onClick={() => handleSwitchBranch(branch)}
                                className={`px-3 py-1 text-sm rounded transition-colors ${
                                    branch === currentBranch
                                        ? "bg-blue-500 text-white font-medium"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                                {branch}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Commit Graph */}
            <div className="flex-1 relative">
                {commits.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        No commits yet. Make some commits to see history!
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodeClick={onNodeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={true}
                    >
                        <Background />
                        <Controls />
                    </ReactFlow>
                )}
            </div>

            {/* Action Panel */}
            {selectedCommit && (
                <div className="flex-none px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                            Commit {selectedCommit.toString().slice(0, 8)}...
                        </span>
                        <button
                            onClick={handleCheckout}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Checkout
                        </button>
                        <button
                            onClick={handleCreateBranch}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                        >
                            Branch from here
                        </button>
                        <button
                            onClick={() => setSelectedCommit(null)}
                            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
