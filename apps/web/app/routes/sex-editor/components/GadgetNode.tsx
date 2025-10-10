import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./WorkspaceTree.module.css";
import { BigNumberView } from "./views/BigNumberView";
import { LineChartView } from "./views/LineChartView";
import { TableView } from "./views/TableView";
import { GaugeView } from "./views/GaugeView";
import { DashboardView } from "./views/DashboardView";
import { SexTableView } from "./views/SexTableView";

// Map of view names to components
const VIEW_COMPONENTS: Record<string, React.ComponentType<NodeProps>> = {
    bigNumber: BigNumberView,
    lineChart: LineChartView,
    table: TableView,
    gauge: GaugeView,
    dashboard: DashboardView,
    sexTable: SexTableView,
};

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
    const [viewName, setViewName] = useState(
        gadget.getView ? gadget.getView() : "default"
    );

    // Flash animation on receive
    useEffect(() => {
        const cleanup = gadget.tap((effect: any) => {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);

            // Listen for view changes
            if (effect.viewChanged) {
                setViewName(effect.viewChanged.to);
            }
        });
        return cleanup;
    }, [gadget]);

    // Check if gadget has a custom view
    const ViewComponent = viewName !== "default"
        ? VIEW_COMPONENTS[viewName]
        : null;

    // If custom view exists, render it
    if (ViewComponent) {
        return <ViewComponent data={data} selected={selected} />;
    }

    // Otherwise render default box view
    const icon = getIcon(gadget);
    const preview = getPreview(state);
    // Check if gadget has stateSpec() - semantic signal for "has internal workspace"
    const isNavigable = typeof gadget.stateSpec === "function";

    const handleDoubleClick = () => {
        if (isNavigable && onNavigateInto) {
            onNavigateInto(name, gadget);
        }
    };

    return (
        <div
            onDoubleClick={handleDoubleClick}
            className={`bg-white border-2 rounded shadow-md min-w-[180px] ${
                selected ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-300"
            } ${isFlashing ? styles.flash : ""} ${
                isNavigable ? "cursor-pointer hover:border-purple-400 hover:shadow-lg transition-all" : ""
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
                    {isNavigable && <span className="text-xs text-purple-500">↴</span>}
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
