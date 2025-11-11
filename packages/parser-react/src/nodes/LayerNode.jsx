/**
 * LayerNode - Custom React Flow node for displaying LayeredControl layers
 *
 * Shows layer metadata including quad count, staging status, branch, and commits.
 * Includes input/output handles for creating routing connections.
 */

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

/**
 * LayerNode component
 *
 * @param {Object} props
 * @param {Object} props.data - Node data
 * @param {string} props.data.label - Layer name
 * @param {number} props.data.quadCount - Number of quads in layer
 * @param {boolean} props.data.hasStaging - Whether layer has uncommitted changes
 * @param {number} props.data.stagingCount - Number of staged quads
 * @param {string|null} props.data.branch - Current branch name
 * @param {number} props.data.commitCount - Number of commits
 * @param {boolean} props.data.isActive - Whether this is the active layer
 * @param {boolean} props.selected - Whether node is selected (from React Flow)
 */
export const LayerNode = memo(({ data, selected }) => {
    const { label, quadCount, hasStaging, stagingCount, branch, isActive } =
        data;

    return (
        <div
            className={`
                px-3 py-2 rounded-lg border-2 bg-white shadow-md min-w-[180px]
                ${isActive ? "border-blue-500 bg-blue-50" : "border-slate-300"}
                ${selected ? "ring-2 ring-blue-400" : ""}
            `}
        >
            {/* Input handle (left side) */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 bg-slate-400 border-2 border-white"
            />

            {/* Layer name */}
            <div className="font-semibold text-sm text-slate-900 mb-1">
                {label}
            </div>

            {/* Branch badge */}
            {branch && (
                <div className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                    <span className="text-slate-400">─</span>
                    <span className="font-mono">{branch}</span>
                </div>
            )}

            {/* Quad count */}
            <div className="text-xs text-slate-600 flex items-center gap-1">
                <span className="text-slate-900">●</span>
                <span>{quadCount} quad{quadCount !== 1 ? "s" : ""}</span>
            </div>

            {/* Staging indicator */}
            {hasStaging && (
                <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                    <span className="text-orange-500">⚠</span>
                    <span>{stagingCount} staged</span>
                </div>
            )}

            {/* Output handle (right side) */}
            <Handle
                type="source"
                position={Position.Right}
                className="w-3 h-3 bg-slate-400 border-2 border-white"
            />
        </div>
    );
});

LayerNode.displayName = "LayerNode";
