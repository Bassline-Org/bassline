import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "./WorkspaceTree.module.css";
import { BigNumberView } from "./views/BigNumberView";
import { LineChartView } from "./views/LineChartView";
import { TableView } from "./views/TableView";
import { GaugeView } from "./views/GaugeView";
import { DashboardView } from "./views/DashboardView";
import { SexTableView } from "./views/SexTableView";
import { ButtonView } from "./views/ButtonView";
import { SliderView } from "./views/SliderView";
import { ToggleView } from "./views/ToggleView";
import { PipelineBuilderView } from "./views/PipelineBuilderView";

// Map of view names to components
const VIEW_COMPONENTS: Record<string, React.ComponentType<NodeProps>> = {
    bigNumber: BigNumberView,
    lineChart: LineChartView,
    table: TableView,
    gauge: GaugeView,
    dashboard: DashboardView,
    sexTable: SexTableView,
    button: ButtonView,
    slider: SliderView,
    toggle: ToggleView,
    pipelineBuilder: PipelineBuilderView,
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

function getPortColor(type: string): string {
    const colors: Record<string, string> = {
        number: "#3b82f6",
        string: "#10b981",
        boolean: "#eab308",
        error: "#ef4444",
        any: "#6b7280",
    };
    return colors[type] || colors.any;
}

function getInputPorts(gadget: any): Array<[string, any]> {
    if (!gadget.inputs) return [];

    // Check if it's a single-value input (string/primitive type)
    if (typeof gadget.inputs !== 'object' || gadget.inputs === null) {
        return [["value", { type: gadget.inputs }]];
    }

    // Multi-field input (object of port specs)
    return Object.entries(gadget.inputs);
}

function getOutputPorts(gadget: any): Array<[string, any]> {
    if (!gadget.outputs) return [];
    return Object.entries(gadget.outputs);
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

    const inputPorts = getInputPorts(gadget);
    const outputPorts = getOutputPorts(gadget);

    return (
        <div
            onDoubleClick={handleDoubleClick}
            className={`bg-white border-2 rounded shadow-md min-w-[180px] relative ${
                selected ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-300"
            } ${isFlashing ? styles.flash : ""} ${
                isNavigable ? "cursor-pointer hover:border-purple-400 hover:shadow-lg transition-all" : ""
            }`}
        >
            {/* Input Ports (Left side) */}
            {inputPorts.map(([portName, spec], index) => {
                const yPos = 30 + (index * 25); // Start at 30px, 25px spacing
                return (
                    <Handle
                        key={`input-${portName}`}
                        type="target"
                        position={Position.Left}
                        id={portName}
                        style={{
                            top: `${yPos}px`,
                            background: getPortColor(spec.type),
                            width: "10px",
                            height: "10px",
                            border: "2px solid white",
                        }}
                        title={`${portName} (${spec.type})${spec.description ? ': ' + spec.description : ''}`}
                    />
                );
            })}

            {/* Main input handle (for whole-gadget connections) */}
            <Handle
                type="target"
                position={Position.Top}
                id="__main__"
                className="!bg-blue-500"
            />

            {/* Output Ports (Right side) */}
            {outputPorts.map(([portName, spec], index) => {
                const yPos = 30 + (index * 25); // Start at 30px, 25px spacing
                return (
                    <Handle
                        key={`output-${portName}`}
                        type="source"
                        position={Position.Right}
                        id={portName}
                        style={{
                            top: `${yPos}px`,
                            background: getPortColor(spec.type),
                            width: "10px",
                            height: "10px",
                            border: "2px solid white",
                        }}
                        title={`${portName} (${spec.type})${spec.description ? ': ' + spec.description : ''}`}
                    />
                );
            })}

            {/* Main output handle (kept for backwards compat) */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="__main_output__"
                className="!bg-green-500"
            />

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

                {/* Port labels (optional - can be removed if too cluttered) */}
                {(inputPorts.length > 0 || outputPorts.length > 0) && (
                    <div className="text-[10px] text-gray-400 flex justify-between mt-2">
                        <div>
                            {inputPorts.map(([name]) => (
                                <div key={name}>{name}</div>
                            ))}
                        </div>
                        <div className="text-right">
                            {outputPorts.map(([name]) => (
                                <div key={name}>{name}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

GadgetNode.displayName = "GadgetNode";
