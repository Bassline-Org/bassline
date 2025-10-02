import type { Route } from "./+types/canvas-demo";
import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  type XYPosition,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection as ReactFlowConnection,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { table, cells } from 'port-graphs';
import type { SweetTable, SweetCell, Implements, Cleanup } from 'port-graphs';
import type { Table, Valued } from 'port-graphs/protocols';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Canvas Demo - Bassline" },
    { name: "description", content: "Visual gadget network canvas" },
  ];
}

type Pos = { x: number, y: number }
type NodeType = 'max' | 'min' | 'union'
type SCell<T> = Implements<Valued<T>> & SweetCell<T>;
type STable<T> = Implements<Table<string, T>> & SweetTable<T>;
type Dims = { width: number, height: number };
type NodeValue = {
  position: Pos,
  type: NodeType,
  dims: Dims,
  gadget: any
}
type NodeRow = {
  position: SCell<Pos>,
  type: SCell<NodeType>,
  dims: SCell<Dims>,
  gadget: any,
}

// Cell Node Component
function CellNode({ data }: { data: NodeValue }) {
  return (
    <>
      <Handle id='out' position={Position.Right} type="source" />
      <div className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg shadow-md min-w-[120px]">
        <div className="text-xs font-semibold text-slate-500 mb-2">
          {data.type.toUpperCase()} CELL
        </div>
        <div className="text-2xl font-bold text-center mb-2">{data.gadget}</div>
      </div>
      <Handle id='in' position={Position.Left} type="target" />
    </>
  );
}

const nodeTypes: NodeTypes = {
  cell: CellNode,
  max: CellNode,
  min: CellNode,
  union: CellNode,
};

function CanvasView({
  nodeValues,
  nodes
}: { nodeValues: Record<string, NodeValue>, nodes: STable<NodeRow>, }) {
  // React Flow's local state (for smooth interactions)
  const [reactNodes, setReactNodes] = useState<Node[]>(Object.entries(nodeValues).map(([k, v]) => ({ id: k, position: v.position as XYPosition, type: v.type, data: v })));
  const [reactEdges, setReactEdges] = useState<Edge[]>([]);

  // // Interaction handlers (forward to network)
  // const onConnect = useCallback((connection: ReactFlowConnection) => {
  //   if (!connection.source || !connection.target) return;
  //   const id = `${connection.source}-${connection.target}`;
  //   network.connections.set({ [id]: { from: connection.source, to: connection.target } });
  // }, [network.connections]);

  // const onEdgesDelete = useCallback((edges: Edge[]) => {
  //   edges.forEach(edge => {
  //     network.connections.set({ [edge.id]: null });
  //     const cleanup = network.taps.get(edge.id);
  //     if (cleanup) {
  //       cleanup();
  //     }
  //   });
  // }, [network.connections, network.taps]);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    // Send new position to the position cell
    nodes.get(node.id)?.position.receive(node.position);
  }, [nodes]);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header with view selector */}
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div className="font-medium text-sm text-gray-700">
          {/* { label || 'Canvas View'} */}
          'Canvas'
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            <span>Nodes: {reactNodes.length}</span>
            <span className="ml-3">Edges: {reactEdges.length}</span>
          </div>
          <select
            // value={viewId}
            // onChange={(e) => viewIdCell.receive(e.target.value as string)}
            className="px-3 py-1 text-sm border rounded bg-white"
          >
            {/* {Object.keys(views).map(id => (
              <option key={id} value={id}>
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </option>
            ))} */}
          </select>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={reactNodes}
          edges={reactEdges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => setReactNodes((old) => applyNodeChanges(changes, old))}
          onEdgesChange={(changes) => setReactEdges((old) => applyEdgeChanges(changes, old))}
          //onConnect={onConnect}
          //onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function CanvasDemo() {
  // Create network tables
  const network = useMemo(() => {
    // Create tables - nodes with per-property gadgets, connections, and taps
    const nodes = table.first<NodeRow>({} as Record<string, NodeRow>);
    const [nodeValues, cleanup] = table.flattenTable<NodeRow, NodeValue>(nodes);
    const connections = table.last<Connection | null>({} as Record<string, Connection | null>);
    const taps = table.last<Cleanup>({});

    // Initialize test network - each property is a gadget!
    nodes.set({
      'a': {
        position: cells.last<XYPosition>({ x: 100, y: 100 }),
        type: cells.last('max' as NodeType),
        dims: cells.last<Dims>({ width: 100, height: 100 } as Dims),
        gadget: cells.max(),
      },
      'b': {
        position: cells.last<XYPosition>({ x: 100, y: 300 }),
        type: cells.last('max' as NodeType),
        dims: cells.last<Dims>({ width: 100, height: 100 } as Dims),
        gadget: cells.max(),
      },
      'c': {
        position: cells.last<XYPosition>({ x: 400, y: 200 }),
        type: cells.last('max' as NodeType),
        dims: cells.last<Dims>({ width: 100, height: 100 } as Dims),
        gadget: cells.max(),
      },
    });

    // // Initialize connections
    // connections.set({
    //   'a-b': { from: 'a', to: 'b' },
    //   'c-b': { from: 'c', to: 'b' },
    // });

    return {
      nodes,
      nodeValues,
      connections,
      taps,
    } as const;
  }, []);

  return (
    <div className="h-screen w-screen flex">
      <CanvasView
        // currentViewId={network.currentViewLeft}
        // views={network.views}
        // network={{
        // nodes: network.nodes,
        // connections: network.connections,
        // taps: network.taps,
        // }}
        nodes={network.nodes}
        nodeValues={network.nodeValues.current()}
      //label="Left View"
      />

      <div className="w-1 bg-gray-300" />

      {/* <CanvasView
        currentViewId={network.currentViewRight}
        views={network.views}
        network={{
          nodes: network.nodes,
          connections: network.connections,
          taps: network.taps,
        }}
        label="Right View"
      /> */}
    </div>
  );
}