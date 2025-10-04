import { useGadget } from "@bassline/react";
import { useParams, useSearchParams } from "react-router";
import { systemTable } from "./playground";
import { useEffect, useState } from "react";
import { applyEdgeChanges, applyNodeChanges, Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Implements, SweetTable, Table } from "@bassline/core";

export function resolvePath(id: string) {
    if (id === 'system') return systemTable;
    return id.split('/').reduce((acc, curr) => acc?.get(curr) ?? null, systemTable);
}

export default function Canvas() {
    const [params] = useSearchParams();
    const id = params.get("id");

    const [tableState] = useGadget(resolvePath(id!))
    if (!tableState) {
        return <div>Table not found</div>
    }

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    useEffect(() => {
        setNodes(Object.entries(tableState).map(([id, cell]) => ({
            id,
            position: { x: 0, y: 0 },
            data: { cell, label: id }
        })))
    }, [tableState])

    return (
        <div className="w-screen h-screen">
            <ReactFlow
                className="w-full h-full"
                nodes={nodes}
                edges={edges}
                onNodesChange={(changes) => setNodes((old) => applyNodeChanges(changes, old))}
                onEdgesChange={(changes) => setEdges((old) => applyEdgeChanges(changes, old))}
            >
                <Background />
                <Controls />
                <MiniMap nodeStrokeWidth={3} />
            </ReactFlow>
        </div>
    )
}