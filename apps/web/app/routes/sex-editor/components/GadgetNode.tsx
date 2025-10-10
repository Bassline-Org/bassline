import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./WorkspaceTree.module.css";

function getIcon(gadget: any): string {
    if (gadget.pkg === "@bassline/systems") return "📦";
    if (gadget.pkg === "@bassline/cells/numeric") return "🔢";
    if (gadget.pkg === "@bassline/cells/tables") return "📝";
    if (gadget.pkg === "@bassline/relations") return "🔗";
    if (gadget.pkg?.startsWith("@bassline/fn")) return "🔧";
    if (gadget.pkg === "@bassline/cells/unsafe") return "⚡";
    if (gadget.pkg === "@bassline/cells/set") return "📚";
    return "◆";
}

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

export const GadgetNode = memo(({ data, selected }: NodeProps) => {
    const { name, gadget, onNavigateInto } = data;
    const state = gadget.useCurrent();
    const [isFlashing, setIsFlashing] = useState(false);

    // Flash animation on receive
    useEffect(() => {
        const cleanup = gadget.tap(() => {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);
        });
        return cleanup;
    }, [gadget]);

    const icon = getIcon(gadget);
    const preview = getPreview(state);
    const isSex = gadget.pkg === "@bassline/systems" && gadget.name === "sex";

    const handleDoubleClick = () => {
        if (isSex && onNavigateInto) {
            onNavigateInto(name, gadget);
        }
    };

    return (
        <div
            onDoubleClick={handleDoubleClick}
            className={`bg-white border-2 rounded shadow-md min-w-[180px] ${
                selected ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-300"
            } ${isFlashing ? styles.flash : ""} ${
                isSex ? "cursor-pointer hover:border-purple-400 hover:shadow-lg transition-all" : ""
            }`}
        >
            {/* Connection handles */}
            <Handle type="target" position={Position.Top} className="!bg-blue-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-green-500" />

            {/* Node content */}
            <div className="p-3 space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <span className="font-semibold text-sm truncate">{name}</span>
                    {isSex && <span className="text-xs text-purple-500">↴</span>}
                </div>
                <div className="text-xs text-gray-500 font-mono truncate">
                    {gadget.pkg}/{gadget.name}
                </div>
                <div className="text-xs text-gray-700 font-mono bg-gray-50 p-1 rounded truncate">
                    {preview}
                </div>
            </div>
        </div>
    );
});

GadgetNode.displayName = "GadgetNode";
