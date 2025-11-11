/**
 * StagingCommitPanel - Git-style version control panel for LayeredControl
 *
 * Shows staging area, commit functionality, history, and branch operations.
 * Integrates with LayeredControl's Git-like workflow.
 */

import { useCallback, useState } from "react";
import {
    useBranches,
    useCommits,
    useLayer,
    useLayeredControl,
    useStaging,
} from "../hooks/useLayeredControl.jsx";
import { useWorkspace } from "../workspace/WorkspaceContext.jsx";
import { serializeQuad } from "@bassline/parser/control";

/**
 * StagingCommitPanel component
 */
export function StagingCommitPanel() {
    const { activeLayer } = useWorkspace();
    const lc = useLayeredControl();
    const layer = useLayer(activeLayer);
    const stagingInfo = useStaging(activeLayer);
    const commitHistory = useCommits(activeLayer);
    const branchInfo = useBranches(activeLayer);

    const [commitMessage, setCommitMessage] = useState("");
    const [newBranchName, setNewBranchName] = useState("");
    const [error, setError] = useState(null);

    // Get current branch from branchInfo
    const currentBranch = branchInfo.current;

    // Get staged quads
    const stagedQuads = activeLayer ? lc.getStagedQuads(activeLayer) : [];

    // Handle unstage single quad
    const handleUnstage = useCallback(
        (quadHash) => {
            if (!activeLayer) return;
            try {
                lc.unstage(activeLayer, quadHash);
                setError(null);
            } catch (err) {
                setError(err.message);
            }
        },
        [lc, activeLayer],
    );

    // Handle clear all staging
    const handleClearStaging = useCallback(() => {
        if (!activeLayer) return;
        try {
            lc.clearStaging(activeLayer);
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, [lc, activeLayer]);

    // Handle commit
    const handleCommit = useCallback(() => {
        if (!activeLayer || stagingInfo.count === 0) return;
        try {
            lc.commit(activeLayer, commitMessage);
            setCommitMessage("");
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, [lc, activeLayer, commitMessage, stagingInfo.count]);

    // Handle restore to commit
    const handleRestore = useCallback(
        (commitHash) => {
            if (!activeLayer) return;
            try {
                lc.restore(activeLayer, commitHash);
                setError(null);
            } catch (err) {
                setError(err.message);
            }
        },
        [lc, activeLayer],
    );

    // Handle create branch
    const handleCreateBranch = useCallback(() => {
        if (!activeLayer || !newBranchName.trim()) return;
        try {
            lc.createBranch(activeLayer, newBranchName.trim());
            setNewBranchName("");
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, [lc, activeLayer, newBranchName]);

    // Handle switch branch
    const handleSwitchBranch = useCallback(
        (branchName) => {
            if (!activeLayer) return;
            try {
                lc.switchBranch(activeLayer, branchName);
                setError(null);
            } catch (err) {
                setError(err.message);
            }
        },
        [lc, activeLayer],
    );

    // Handle delete branch
    const handleDeleteBranch = useCallback(
        (branchName) => {
            if (!activeLayer) return;
            try {
                lc.deleteBranch(activeLayer, branchName);
                setError(null);
            } catch (err) {
                setError(err.message);
            }
        },
        [lc, activeLayer],
    );

    // Get quad count from layer
    const quadCount = layer?.graph?.quads
        ? Object.keys(layer.graph.quads).length
        : 0;

    if (!activeLayer) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50">
                <p className="text-slate-500">No active layer selected</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header with status bar */}
            <div className="flex-none border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">
                            {activeLayer}
                        </h3>
                        {currentBranch && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {currentBranch}
                            </span>
                        )}
                        {!currentBranch && commitHistory.length > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                detached HEAD
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>
                            <strong>{quadCount}</strong> quads
                        </span>
                        <span>
                            <strong>{stagingInfo.count}</strong> staged
                        </span>
                        <span>
                            <strong>{commitHistory.length}</strong> commits
                        </span>
                    </div>
                </div>

                {/* Error display */}
                {error && (
                    <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {error}
                    </div>
                )}
            </div>

            {/* Main content area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Staged Changes Section */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-slate-900">
                            Staged Changes ({stagingInfo.count})
                        </h4>
                        {stagingInfo.count > 0 && (
                            <button
                                onClick={handleClearStaging}
                                className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    {stagingInfo.count === 0
                        ? (
                            <div className="text-sm text-slate-500 italic bg-slate-50 rounded px-3 py-2">
                                No changes staged
                            </div>
                        )
                        : (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {stagedQuads.map((quad, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-start justify-between gap-2 text-xs font-mono bg-slate-50 rounded px-2 py-1.5 hover:bg-slate-100"
                                    >
                                        <span className="flex-1 text-slate-700">
                                            {serializeQuad(quad)}
                                        </span>
                                        <button
                                            onClick={() =>
                                                handleUnstage(quad.hash())}
                                            className="text-red-600 hover:text-red-700"
                                            title="Unstage"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                </div>

                {/* Commit Section */}
                <div>
                    <h4 className="font-semibold text-slate-900 mb-3">
                        Commit
                    </h4>
                    <div className="space-y-2">
                        <textarea
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Commit message (optional)"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                        />
                        <button
                            onClick={handleCommit}
                            disabled={stagingInfo.count === 0}
                            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                            Commit{" "}
                            {stagingInfo.count > 0 && `(${stagingInfo.count})`}
                        </button>
                    </div>
                </div>

                {/* Commit History Section */}
                <div>
                    <h4 className="font-semibold text-slate-900 mb-3">
                        History ({commitHistory.length})
                    </h4>
                    {commitHistory.length === 0
                        ? (
                            <div className="text-sm text-slate-500 italic bg-slate-50 rounded px-3 py-2">
                                No commits yet
                            </div>
                        )
                        : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {commitHistory.map((commit) => (
                                    <div
                                        key={commit.hash}
                                        className="bg-slate-50 rounded px-3 py-2 hover:bg-slate-100"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-mono text-slate-500">
                                                    {commit.hash.toString(16)
                                                        .slice(0, 8)}
                                                </div>
                                                <div className="text-sm text-slate-900 mt-0.5">
                                                    {commit.message ||
                                                        "(no message)"}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {new Date(commit.timestamp)
                                                        .toLocaleString()} •
                                                    {" "}
                                                    {commit.quadCount} quads
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    handleRestore(commit.hash)}
                                                className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                                            >
                                                Restore
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                </div>

                {/* Branches Section */}
                <div>
                    <h4 className="font-semibold text-slate-900 mb-3">
                        Branches
                    </h4>

                    {/* Create new branch */}
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={newBranchName}
                            onChange={(e) => setNewBranchName(e.target.value)}
                            placeholder="New branch name"
                            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateBranch();
                            }}
                        />
                        <button
                            onClick={handleCreateBranch}
                            disabled={!newBranchName.trim() ||
                                commitHistory.length === 0}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                            Create
                        </button>
                    </div>

                    {/* Branch list */}
                    {branchInfo.branches.length === 0
                        ? (
                            <div className="text-sm text-slate-500 italic bg-slate-50 rounded px-3 py-2">
                                No branches created
                            </div>
                        )
                        : (
                            <div className="space-y-1">
                                {branchInfo.branches.map((branch) => (
                                    <div
                                        key={branch}
                                        className={`flex items-center justify-between px-3 py-2 rounded ${
                                            branch === currentBranch
                                                ? "bg-blue-50 border border-blue-200"
                                                : "bg-slate-50 hover:bg-slate-100"
                                        }`}
                                    >
                                        <span
                                            className={`text-sm font-medium ${
                                                branch === currentBranch
                                                    ? "text-blue-900"
                                                    : "text-slate-700"
                                            }`}
                                        >
                                            {branch}
                                            {branch === currentBranch && (
                                                <span className="ml-2 text-xs text-blue-600">
                                                    (current)
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex gap-2">
                                            {branch !== currentBranch && (
                                                <button
                                                    onClick={() =>
                                                        handleSwitchBranch(
                                                            branch,
                                                        )}
                                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                                >
                                                    Switch
                                                </button>
                                            )}
                                            {branch !== currentBranch && (
                                                <button
                                                    onClick={() =>
                                                        handleDeleteBranch(
                                                            branch,
                                                        )}
                                                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}
