import { useEffect, useMemo } from "react";
import { fromSpec } from "@bassline/core";

interface WorkspaceTreeProps {
    spawned: Record<string, any>;
    selected: any;
    onSelect: (gadget: any) => void;
    onContextMenu?: (e: React.MouseEvent, name: string, gadget: any) => void;
}

export function WorkspaceTree({
    spawned,
    selected,
    onSelect,
    onContextMenu,
}: WorkspaceTreeProps) {
    return (
        <div className="space-y-1">
            {Object.entries(spawned).map(([name, gadget]) => (
                <TreeNode
                    key={name}
                    name={name}
                    gadget={gadget}
                    selected={selected}
                    onSelect={onSelect}
                    {...(onContextMenu ? { onContextMenu } : {})}
                />
            ))}
        </div>
    );
}

interface TreeNodeProps {
    name: string;
    gadget: any;
    selected: any;
    onSelect: (gadget: any) => void;
    onContextMenu?: (e: React.MouseEvent, name: string, gadget: any) => void;
}

function TreeNode({
    name,
    gadget,
    selected,
    onSelect,
    onContextMenu,
}: TreeNodeProps) {
    const state = gadget.useCurrent();
    const isSex = gadget.pkg === "@bassline/systems" && gadget.name === "sex";

    // Local gadget for expansion state
    const expanded = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: false,
            }),
        [],
    );
    const [isExpanded, setExpanded] = expanded.useState();

    useEffect(() => () => expanded.kill(), [expanded]);

    const isSelected = selected === gadget;
    const icon = getIcon(gadget);
    const preview = getPreview(state);

    return (
        <div>
            <div
                onClick={() => onSelect(gadget)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu?.(e, name, gadget);
                }}
                className={`px-2 py-1 rounded cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${
                    isSelected ? "bg-blue-100" : ""
                }`}
            >
                {isSex && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!isExpanded);
                        }}
                        className="w-4 text-xs"
                    >
                        {isExpanded ? "▼" : "▶"}
                    </button>
                )}
                <span className="text-sm">{icon}</span>
                <span className="font-mono text-sm font-semibold">{name}</span>
                <span className="text-xs text-gray-500">{preview}</span>
            </div>
            {isSex && isExpanded && (
                <div className="ml-6 mt-1">
                    <WorkspaceTree
                        spawned={state}
                        selected={selected}
                        onSelect={onSelect}
                        {...(onContextMenu ? { onContextMenu } : {})}
                    />
                </div>
            )}
        </div>
    );
}

function getIcon(gadget: any): string {
    if (gadget.pkg === "@bassline/systems") return "📦";
    if (gadget.pkg === "@bassline/cells/numeric") return "🔢";
    if (gadget.pkg === "@bassline/cells/tables") return "📝";
    if (gadget.pkg === "@bassline/relations") return "🔗";
    return "◆";
}

function getPreview(state: any): string {
    if (state === null || state === undefined) return "null";
    if (typeof state === "object") {
        if (Object.keys(state).length === 0) return "{}";
        return `{${Object.keys(state).length}}`;
    }
    const str = String(state);
    return str.length > 20 ? str.slice(0, 20) + "..." : str;
}
