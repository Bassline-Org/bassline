import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

function getPreview(state: any): string {
    if (state === null || state === undefined) return "null";
    if (typeof state === "object") {
        if (Array.isArray(state)) {
            return `[${state.length}]`;
        }
        const keys = Object.keys(state);
        return keys.length === 0 ? "{}" : `{${keys.length}}`;
    }
    const str = String(state);
    return str.length > 20 ? str.slice(0, 20) + "..." : str;
}

export const ReferenceNode = memo(({ data, selected }: NodeProps) => {
    const { name, gadget, referencePath } = data;
    const state = gadget.useCurrent();
    const preview = getPreview(state);

    return (
        <div
            className={`bg-purple-50 border-2 border-dashed rounded shadow-md min-w-[180px] relative ${
                selected ? "border-purple-500 ring-2 ring-purple-300" : "border-purple-300"
            }`}
        >
            {/* Main input handle (top) */}
            <Handle
                type="target"
                position={Position.Top}
                id="__main__"
                className="!bg-purple-500"
            />

            {/* Main output handle (bottom) */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="__main_output__"
                className="!bg-purple-500"
            />

            {/* Node content */}
            <div className="p-3 space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🔗</span>
                    <span className="font-semibold text-sm truncate">{name}</span>
                    <span className="text-xs text-purple-600">ref</span>
                </div>
                <div className="text-xs text-gray-500 font-mono truncate">
                    → {referencePath}
                </div>
                <div className="text-xs text-gray-700 font-mono bg-white p-1 rounded truncate">
                    {preview}
                </div>
            </div>
        </div>
    );
});

ReferenceNode.displayName = "ReferenceNode";
