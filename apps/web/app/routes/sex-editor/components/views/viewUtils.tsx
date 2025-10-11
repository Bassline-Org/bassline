import { Handle, Position } from "@xyflow/react";

/**
 * Renders input port on the left side of a custom view
 */
export function InputPort() {
    return (
        <Handle
            type="target"
            position={Position.Left}
            style={{ top: "50%" }}
            className="w-3 h-3 bg-blue-500 border-2 border-white"
        />
    );
}

/**
 * Renders output port on the right side of a custom view
 */
export function OutputPort() {
    return (
        <Handle
            type="source"
            position={Position.Right}
            style={{ top: "50%" }}
            className="w-3 h-3 bg-green-500 border-2 border-white"
        />
    );
}

/**
 * Renders both input and output ports
 */
export function BothPorts() {
    return (
        <>
            <InputPort />
            <OutputPort />
        </>
    );
}
