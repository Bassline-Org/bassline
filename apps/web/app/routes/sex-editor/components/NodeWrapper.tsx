import { memo, ReactNode, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import styles from "./WorkspaceTree.module.css";

interface NodeWrapperProps {
    gadget: any;
    name: string;
    selected: boolean;
    children: ReactNode;
    minWidth?: number;
}

function getPortColor(type: string): string {
    const colors: Record<string, string> = {
        number: "#3b82f6",
        string: "#10b981",
        boolean: "#eab308",
        error: "#ef4444",
        any: "#6b7280",
        array: "#8b5cf6",
        object: "#f59e0b",
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

export const NodeWrapper = memo(({ gadget, name, selected, children, minWidth = 180 }: NodeWrapperProps) => {
    const [isFlashing, setIsFlashing] = useState(false);

    // Flash animation on receive
    useEffect(() => {
        const cleanup = gadget.tap(() => {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);
        });
        return cleanup;
    }, [gadget]);

    const inputPorts = getInputPorts(gadget);
    const outputPorts = getOutputPorts(gadget);

    return (
        <div
            className={`bg-white border-2 rounded shadow-md relative ${
                selected ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-300"
            } ${isFlashing ? styles.flash : ""}`}
            style={{ minWidth: `${minWidth}px` }}
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

            {/* View content */}
            {children}

            {/* Port labels (optional - shown at bottom) */}
            {(inputPorts.length > 0 || outputPorts.length > 0) && (
                <div className="text-[10px] text-gray-400 flex justify-between px-3 pb-2">
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
    );
});

NodeWrapper.displayName = "NodeWrapper";
