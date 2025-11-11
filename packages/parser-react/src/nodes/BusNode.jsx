/**
 * BusNode - Custom React Flow node for displaying routing buses
 *
 * Buses are routing-only nodes with no quad storage.
 * Displayed as simple junction points with input/output handles.
 */

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

/**
 * BusNode component
 *
 * @param {Object} props
 * @param {Object} props.data - Node data
 * @param {string} props.data.label - Bus name
 * @param {boolean} props.selected - Whether node is selected (from React Flow)
 */
export const BusNode = memo(({ data, selected }) => {
    const { label } = data;

    return (
        <div className="relative flex items-center justify-center">
            {/* Input handle (top) */}
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 bg-purple-400 border-2 border-white"
            />

            {/* Bus circle */}
            <div
                className={`
                    w-14 h-14 rounded-full border-2 bg-purple-50
                    flex items-center justify-center
                    ${selected ? "border-purple-500 ring-2 ring-purple-400" : "border-purple-300"}
                `}
            >
                <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    {/* Junction/merge icon */}
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                    />
                </svg>
            </div>

            {/* Bus label below */}
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-mono text-purple-700 whitespace-nowrap">
                {label}
            </div>

            {/* Output handle (bottom) */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 bg-purple-400 border-2 border-white"
            />
        </div>
    );
});

BusNode.displayName = "BusNode";
