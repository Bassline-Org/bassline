/**
 * PlugboardPanel - Interactive visual routing diagram for LayeredControl
 *
 * Uses React Flow to display layers as nodes and routing connections as edges.
 * Supports drag-and-drop connection creation, edge deletion, and node selection.
 */

import { useCallback, useEffect, useState } from "react";
import {
    Background,
    Controls,
    Panel,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
    useLayeredControl,
    useLayers,
    useRouting,
} from "../hooks/useLayeredControl.jsx";
import { useWorkspace } from "@bassline/parser-react";
import { layersToFlow } from "../utils/layersToFlow.js";
import { LayerNode } from "../nodes/LayerNode.jsx";
import { BusNode } from "../nodes/BusNode.jsx";

// Register custom node types
const nodeTypes = {
    layer: LayerNode,
    bus: BusNode,
};

/**
 * PlugboardPanel - Visual routing diagram component
 */
export function PlugboardPanel() {
    const lc = useLayeredControl();
    const layers = useLayers();
    const routing = useRouting();
    const { activeLayer, setActiveLayer } = useWorkspace();

    // Convert data to React Flow format
    const initialData = layersToFlow(layers, routing, lc, activeLayer);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);

    // Update nodes/edges when data changes
    useEffect(() => {
        const { nodes: newNodes, edges: newEdges } = layersToFlow(
            layers,
            routing,
            lc,
            activeLayer,
        );
        setNodes(newNodes);
        setEdges(newEdges);
    }, [layers, routing, activeLayer, lc, setNodes, setEdges]);

    // Handle new connection creation
    const onConnect = useCallback(
        (connection) => {
            try {
                lc.route(connection.source, connection.target);
            } catch (err) {
                console.error("Failed to create route:", err);
            }
        },
        [lc],
    );

    // Handle edge deletion
    const onEdgesDelete = useCallback(
        (edgesToDelete) => {
            edgesToDelete.forEach((edge) => {
                try {
                    const layer = lc.getLayer(edge.source);
                    if (layer?.output) {
                        // Clear the output and cleanup
                        layer.output = null;
                        if (layer.cleanup) {
                            layer.cleanup();
                            layer.cleanup = null;
                        }
                        // Fire event to update reactive hooks
                        lc.dispatchEvent(
                            new CustomEvent("routing-changed", {
                                detail: { from: edge.source, to: null },
                            }),
                        );
                    }
                } catch (err) {
                    console.error("Failed to delete route:", err);
                }
            });
        },
        [lc],
    );

    // Handle node click (set as active layer)
    const onNodeClick = useCallback(
        (event, node) => {
            // Only set as active if it's a layer (not a bus)
            if (!node.data.isBus) {
                setActiveLayer(node.id);
            }
        },
        [setActiveLayer],
    );

    return (
        <div className="w-full h-full bg-slate-50">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgesDelete={onEdgesDelete}
                onNodeClick={onNodeClick}
                fitView
                fitViewOptions={{
                    padding: 0.2,
                    minZoom: 0.5,
                    maxZoom: 1.5,
                }}
                deleteKeyCode={["Backspace", "Delete"]}
            >
                <Background color="#aaa" gap={16} />
                <Controls />

                {/* Stats panel */}
                <Panel
                    position="top-right"
                    className="bg-white px-3 py-2 rounded-lg shadow-md border border-slate-200"
                >
                    <div className="text-sm text-slate-700">
                        <span className="font-semibold">{layers.length}</span>
                        {" "}
                        layer{layers.length !== 1 ? "s" : ""} •{" "}
                        <span className="font-semibold">{routing.length}</span>
                        {" "}
                        connection{routing.length !== 1 ? "s" : ""}
                    </div>
                </Panel>

                {/* Instructions panel */}
                <Panel
                    position="top-left"
                    className="bg-blue-50 px-3 py-2 rounded-lg shadow-md border border-blue-200"
                >
                    <div className="text-xs text-blue-900 space-y-1">
                        <div>
                            <strong>Drag</strong> from output → input to connect
                        </div>
                        <div>
                            <strong>Delete</strong> key to remove connections
                        </div>
                        <div>
                            <strong>Click</strong> node to set as active
                        </div>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}
