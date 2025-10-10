import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./WorkspaceTree.module.css";

export const WireNode = memo(({ data, selected }: NodeProps) => {
    const { name, gadget } = data;
    const [isFlashing, setIsFlashing] = useState(false);

    // Flash animation on receive (when data flows through)
    useEffect(() => {
        const cleanup = gadget.tap(() => {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);
        });
        return cleanup;
    }, [gadget]);

    return (
        <div className="relative">
            {/* Connection handles */}
            <Handle type="target" position={Position.Left} className="!bg-blue-700 !w-2 !h-2" />
            <Handle type="source" position={Position.Right} className="!bg-blue-700 !w-2 !h-2" />

            {/* Wire pill */}
            <div
                className={`px-3 py-1 rounded-full bg-blue-500 border-2 text-white text-xs
                           font-mono shadow-md whitespace-nowrap select-none
                           hover:bg-blue-600 transition-colors
                           ${selected ? "ring-2 ring-blue-300 border-blue-700" : "border-blue-600"}
                           ${isFlashing ? styles.flash : ""}`}
            >
                🔗 {name}
            </div>
        </div>
    );
});

WireNode.displayName = "WireNode";
