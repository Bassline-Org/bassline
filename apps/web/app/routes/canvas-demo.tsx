import type { Route } from "./+types/canvas-demo";
import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection as ReactFlowConnection,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGadget } from 'port-graphs-react';
import { table, cells, deriveFrom } from 'port-graphs';
import type { SweetTable, SweetCell, Implements, Cleanup } from 'port-graphs';
import type { Table, Valued } from 'port-graphs/protocols';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Canvas Demo - Bassline" },
    { name: "description", content: "Visual gadget network canvas" },
  ];
}

type NodeType = 'max' | 'min';
type Connection = { from: string; to: string };

// View system types
type NetworkTableState = SweetTable<any> & Implements<Valued<any>>;
type NetworkTable = Implements<Table<string, NetworkTableState>>;
type VisualState = {
  nodes: Node[];
  edges: Edge[];
};
type ViewFn = (network: NetworkTableState) => VisualState;

// Default view: show everything
const allView: ViewFn = (network) => {
  console.log('network', network);
  const positions = network['positions']?.current() ?? {};
  const nodeTypes = network['nodeTypes']?.current() ?? {};
  const gadgets = network['gadgets']?.current() ?? {};
  const connections = network['connections']?.current() ?? {};

  const nodes = Object.entries(positions).map(([id, pos]) => ({
    id,
    position: pos as { x: number; y: number },
    type: 'cell' as const,
    data: {
      gadget: gadgets[id] as SweetCell<number> & Implements<Valued<number>>,
      nodeType: nodeTypes[id] as NodeType,
    },
  }));

  const edges = Object.entries(connections)
    .filter(([_, c]) => c !== null)
    .map(([id, c]) => ({
      id,
      source: (c as Connection).from,
      target: (c as Connection).to,
    }));

  return { nodes, edges };
};

// Cell Node Component
function CellNode({ data }: { data: { gadget: SweetCell<number> & Implements<Valued<number>>; nodeType: NodeType } }) {
  const [value, gadget] = useGadget(data.gadget);

  return (
    <>
      <Handle id='out' position={Position.Right} type="source" />
      <div className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg shadow-md min-w-[120px]">

        <div className="text-xs font-semibold text-slate-500 mb-2">
          {data.nodeType.toUpperCase()} CELL
        </div>
        <div className="text-2xl font-bold text-center mb-2">{value}</div>
        <div className="flex gap-1">
          <button
            onClick={() => gadget.receive(value + 1)}
            className="flex-1 px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            +
          </button>
          <button
            onClick={() => gadget.receive(value - 1)}
            className="flex-1 px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            −
          </button>
        </div>
      </div >
      <Handle id='in' position={Position.Left} type="target" />
    </>
  );
}

const nodeTypes: NodeTypes = {
  cell: CellNode,
};

export default function CanvasDemo() {
  // Create network tables
  const network = useMemo(() => {
    const net = table.first<NetworkTableState>({});

    net.set({
      'nodeTypes': table.first<NodeType>({}),
      'positions': table.last<Position>({}),
      'gadgets': table.first<SweetCell<number> & Implements<Valued<number>>>({}),
      'connections': table.last<Connection | null>({}),
      'taps': table.last<Cleanup>({}),
    });

    const [nodeTypes, positions, gadgets, connections, taps] = net.getMany([
      'nodeTypes',
      'positions',
      'gadgets',
      'connections',
      'taps',
    ]);

    // When node type is added, create the gadget
    nodeTypes!.whenAdded((key, type) => {
      const factory = type === 'max' ? cells.max : cells.min;
      gadgets!.set({ [key]: factory(0) });
    });

    // When connection is added, create the network tap
    connections!.whenAdded((id, conn) => {
      if (conn !== null && conn !== undefined) {
        const from = gadgets!.get(conn.from);
        const to = gadgets!.get(conn.to);
        if (from && to) {
          const cleanup = from.provide(to);
          taps!.set({ [id]: cleanup });
        }
      }
    });
    positions?.tap(({ added }) => {
      if (added) {
        console.log('added', added);
      }
    });

    // Initialize test network
    nodeTypes!.set({
      'a': 'max',
      'b': 'max',
      'c': 'max',
    });

    positions!.set({
      'a': { x: 100, y: 100 },
      'b': { x: 100, y: 300 },
      'c': { x: 400, y: 200 },
    });

    connections!.set({
      'a-b': { from: 'a', to: 'b' },
      'c-b': { from: 'c', to: 'b' },
    });

    // Create currentView cell
    const currentView = cells.last<ViewFn>(allView);

    // Create visualState that subscribes to individual tables
    const [visualState] = deriveFrom(
      {
        positions: positions!,
        nodeTypes: nodeTypes!,
        gadgets: gadgets!,
        connections: connections!,
        viewFn: currentView,
        network: net as Implements<Valued<NetworkTableState>>,
      },
      ({ positions, nodeTypes, gadgets, connections, viewFn, network }) => {
        return viewFn(network);
      }
    );

    return { net, nodeTypes, positions, gadgets, connections, taps, currentView, visualState };
  }, []);

  // Subscribe to visual state from network
  const [visual] = useGadget(network.visualState);

  // React Flow's local state (for smooth interactions)
  const [reactNodes, setReactNodes] = useState<Node[]>([]);
  const [reactEdges, setReactEdges] = useState<Edge[]>([]);

  // Sync: Visual state → React state (when network changes)
  useEffect(() => {
    setReactNodes(visual.result?.nodes ?? []);
    setReactEdges(visual.result?.edges ?? []);
  }, [visual]);

  // Interactive handlers
  const onConnect = useCallback((connection: ReactFlowConnection) => {
    if (!connection.source || !connection.target) return;
    const id = `${connection.source}-${connection.target}`;
    network.connections!.set({ [id]: { from: connection.source, to: connection.target } });
  }, [network.connections]);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach(edge => {
      network.connections!.set({ [edge.id]: null });
      // Cleanup the tap
      const cleanup = network.taps!.get(edge.id);
      if (cleanup) {
        cleanup();
        console.log('cleanup', cleanup);
        network.taps!.set({ [edge.id]: null });
      }
    });
  }, [network.connections, network.taps]);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    network.positions!.set({ [node.id]: node.position });
  }, [network.positions]);

  return (
    <div className="h-screen w-screen">
      <div className="absolute top-4 left-4 z-10 bg-white p-4 rounded-lg shadow-lg">
        <h1 className="text-xl font-bold mb-2">Canvas Demo</h1>
        <p className="text-sm text-slate-600 mb-2">
          Data-driven gadget network visualization
        </p>
        <div className="text-xs text-slate-500">
          <div>Nodes: {reactNodes.length}</div>
          <div>Connections: {reactEdges.length}</div>
        </div>
      </div>



      <ReactFlow
        nodes={reactNodes}
        edges={reactEdges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => setReactNodes((old) => applyNodeChanges(changes, old))}
        onEdgesChange={(changes) => setReactEdges((old) => applyEdgeChanges(changes, old))}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div >
  );
}
