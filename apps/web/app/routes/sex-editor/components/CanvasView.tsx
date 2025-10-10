import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    type Node,
    type Edge,
    type Connection,
    type NodeTypes,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { GadgetNode } from "./GadgetNode";

interface CanvasViewProps {
    workspace: Record<string, any>;
    rootSex: any;
    selectionCell: any;
}

const nodeTypes: NodeTypes = {
    gadgetNode: GadgetNode,
};

// Auto-layout using dagre
function getLayoutedElements(nodes: Node[], edges: Edge[]) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 100, ranksep: 150 });

    nodes.forEach((node) => {
        g.setNode(node.id, { width: 200, height: 100 });
    });

    edges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
        const pos = g.node(node.id);
        return {
            ...node,
            position: { x: pos.x - 100, y: pos.y - 50 },
        };
    });

    return { nodes: layoutedNodes, edges };
}

// Helper to find gadget name from gadget reference
function findGadgetName(workspace: Record<string, any>, gadget: any): string | null {
    for (const [name, g] of Object.entries(workspace)) {
        if (g === gadget) return name;
    }
    return null;
}

export function CanvasView({ workspace, rootSex, selectionCell }: CanvasViewProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Transform workspace to initial nodes/edges with auto-layout
    useEffect(() => {
        if (isInitialized) return;

        const initialNodes: Node[] = Object.entries(workspace)
            .filter(([name]) => name !== "__layout")
            .map(([name, gadget]) => ({
                id: name,
                type: "gadgetNode",
                position: { x: 0, y: 0 }, // Will be set by dagre
                data: { name, gadget },
            }));

        const initialEdges: Edge[] = Object.entries(workspace)
            .filter(([_, g]) => g.pkg === "@bassline/relations" && g.name === "scopedWire")
            .map(([name, wireGadget]) => {
                const state = wireGadget.current();
                const sourceName = findGadgetName(workspace, state.source);
                const targetName = findGadgetName(workspace, state.target);
                return {
                    id: name,
                    source: sourceName || "",
                    target: targetName || "",
                    type: "smoothstep",
                    animated: true,
                    data: { wireGadget },
                };
            })
            .filter((edge) => edge.source && edge.target);

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setIsInitialized(true);
    }, [workspace, isInitialized, setNodes, setEdges]);

    // Sync workspace changes to canvas (add/remove nodes/edges)
    useEffect(() => {
        if (!isInitialized) return;

        const workspaceGadgets = new Set(
            Object.keys(workspace).filter((name) => name !== "__layout")
        );
        const canvasNodeIds = new Set(nodes.map((n) => n.id));

        // Find added gadgets
        const addedGadgets = Array.from(workspaceGadgets).filter(
            (name) => !canvasNodeIds.has(name)
        );

        // Find removed gadgets
        const removedGadgets = Array.from(canvasNodeIds).filter(
            (id) => !workspaceGadgets.has(id)
        );

        if (addedGadgets.length > 0 || removedGadgets.length > 0) {
            // Remove deleted nodes
            let updatedNodes = nodes.filter((n) => !removedGadgets.includes(n.id));

            // Add new nodes with auto-layout position
            const newNodes: Node[] = addedGadgets.map((name) => ({
                id: name,
                type: "gadgetNode",
                position: {
                    x: Math.random() * 400,
                    y: Math.random() * 400,
                }, // Random for now
                data: { name, gadget: workspace[name] },
            }));

            updatedNodes = [...updatedNodes, ...newNodes];
            setNodes(updatedNodes);
        }

        // Update edges based on wire gadgets
        const workspaceWires = Object.entries(workspace)
            .filter(([_, g]) => g.pkg === "@bassline/relations" && g.name === "scopedWire")
            .map(([name, wireGadget]) => {
                const state = wireGadget.current();
                const sourceName = findGadgetName(workspace, state.source);
                const targetName = findGadgetName(workspace, state.target);
                return {
                    id: name,
                    source: sourceName || "",
                    target: targetName || "",
                    type: "smoothstep" as const,
                    animated: true,
                    data: { wireGadget },
                };
            })
            .filter((edge) => edge.source && edge.target);

        const currentWireIds = new Set(workspaceWires.map((e) => e.id));
        const canvasEdgeIds = new Set(edges.map((e) => e.id));

        const edgesChanged =
            workspaceWires.length !== edges.length ||
            !workspaceWires.every((e) => canvasEdgeIds.has(e.id));

        if (edgesChanged) {
            setEdges(workspaceWires);
        }
    }, [workspace, nodes, edges, isInitialized, setNodes, setEdges]);

    // Handle new connections (drag from handle to handle)
    const onConnect = useCallback(
        (connection: Connection) => {
            const wireName = `wire_${Date.now()}`;
            rootSex.receive([
                ["wire", wireName, connection.source, connection.target],
            ]);
        },
        [rootSex]
    );

    // Handle node deletion
    const onNodesDelete = useCallback(
        (deleted: Node[]) => {
            deleted.forEach((node) => {
                rootSex.receive([["clear", node.id]]);
            });
        },
        [rootSex]
    );

    // Handle edge deletion
    const onEdgesDelete = useCallback(
        (deleted: Edge[]) => {
            deleted.forEach((edge) => {
                rootSex.receive([["clear", edge.id]]);
            });
        },
        [rootSex]
    );

    // Handle node selection
    const onNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            selectionCell.receive(node.data.gadget);
        },
        [selectionCell]
    );

    return (
        <div className="h-full w-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodesDelete={onNodesDelete}
                onEdgesDelete={onEdgesDelete}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={2}
            >
                <Background />
                <Controls />
                <MiniMap
                    nodeStrokeWidth={3}
                    zoomable
                    pannable
                />
            </ReactFlow>
        </div>
    );
}
