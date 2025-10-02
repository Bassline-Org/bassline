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
type Position = { x: number; y: number };

// View system types
type NetworkTableState = SweetTable<any> & Implements<Valued<any>>;
type NetworkTable = Implements<Table<string, NetworkTableState>>;
type VisualState = {
  nodes: Node[];
  edges: Edge[];
};
type ViewFn = (network: NetworkTableState) => VisualState;

// Shared helper for building visual state from network data
function buildVisualState(
  positions: Record<string, Position>,
  nodeTypes: Record<string, NodeType>,
  gadgets: Record<string, SweetCell<number> & Implements<Valued<number>>>,
  connections: Record<string, Connection | null>,
  nodeFilter?: (id: string, nodeType: NodeType) => boolean
): VisualState {
  // Get node IDs (filtered or all)
  const nodeIds = nodeFilter
    ? Object.keys(positions).filter(id => nodeFilter(id, nodeTypes[id]))
    : Object.keys(positions);

  // Build nodes
  const nodes = nodeIds.map(id => ({
    id,
    position: positions[id],
    type: 'cell' as const,
    data: {
      gadget: gadgets[id],
      nodeType: nodeTypes[id],
    },
  }));

  // Build edges (only if both endpoints visible)
  const visibleNodeSet = new Set(nodeIds);
  const edges = Object.entries(connections)
    .filter(([_, c]) => c !== null)
    .filter(([_, c]) => {
      const conn = c as Connection;
      return visibleNodeSet.has(conn.from) && visibleNodeSet.has(conn.to);
    })
    .map(([id, c]) => ({
      id,
      source: (c as Connection).from,
      target: (c as Connection).to,
    }));

  return { nodes, edges };
}

// Default view: show everything
const allView: ViewFn = (network) => {
  const positions = network['positions']?.current() ?? {};
  const nodeTypes = network['nodeTypes']?.current() ?? {};
  const gadgets = network['gadgets']?.current() ?? {};
  const connections = network['connections']?.current() ?? {};

  return buildVisualState(positions, nodeTypes, gadgets, connections);
};

// Type filter view: show only specified node types
const typeFilterView = (allowedTypes: Set<NodeType>): ViewFn => (network) => {
  const positions = network['positions']?.current() ?? {};
  const nodeTypes = network['nodeTypes']?.current() ?? {};
  const gadgets = network['gadgets']?.current() ?? {};
  const connections = network['connections']?.current() ?? {};

  return buildVisualState(
    positions,
    nodeTypes,
    gadgets,
    connections,
    (id, type) => allowedTypes.has(type)
  );
};

// Factory to create a canvas view system (currentViewId + visualState)
function createCanvasViewSystem(
  positions: SweetTable<Position>,
  nodeTypes: SweetTable<NodeType>,
  gadgets: SweetTable<SweetCell<number> & Implements<Valued<number>>>,
  connections: SweetTable<Connection | null>,
  viewsTable: SweetTable<ViewFn>,
  initialViewId: string
) {
  // Current view ID cell
  const currentViewId = cells.last<string>(initialViewId);

  // Derive ViewFn from ID
  const [viewFn] = deriveFrom(
    { viewId: currentViewId, views: viewsTable },
    ({ viewId, views }) => {
      const view = views[viewId];
      return view({
        positions: positions,
        nodeTypes: nodeTypes,
        gadgets: gadgets,
        connections: connections,
      });
    }
  );
  return { currentViewId, visualState: viewFn };
}

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

// Reusable Canvas View Component
interface CanvasViewProps {
  visualState: SweetCell<VisualState>;
  currentViewId: SweetCell<string>;
  viewsTable: SweetTable<ViewFn>;
  network: {
    positions: SweetTable<Position>;
    connections: SweetTable<Connection | null>;
    taps: SweetTable<Cleanup>;
  };
  label?: string;
}

function CanvasView({
  visualState,
  currentViewId,
  viewsTable,
  network,
  label
}: CanvasViewProps) {
  // Subscribe to visual state
  const [visual] = useGadget(visualState);

  // Subscribe to view metadata
  const [viewsData] = useGadget(viewsTable);
  const [currentView, currentViewCell] = useGadget(currentViewId);

  // React Flow's local state (for smooth interactions)
  const [reactNodes, setReactNodes] = useState<Node[]>([]);
  const [reactEdges, setReactEdges] = useState<Edge[]>([]);

  // Sync: Visual state → React state (when network changes)
  useEffect(() => {
    if (visual?.result) {
      setReactNodes(visual.result.nodes);
      setReactEdges(visual.result.edges);
    }
  }, [visual]);

  // Interaction handlers (forward to network)
  const onConnect = useCallback((connection: ReactFlowConnection) => {
    if (!connection.source || !connection.target) return;
    const id = `${connection.source}-${connection.target}`;
    network.connections.set({ [id]: { from: connection.source, to: connection.target } });
  }, [network.connections]);

  const onEdgesDelete = useCallback((edges: Edge[]) => {
    edges.forEach(edge => {
      network.connections.set({ [edge.id]: null });
      const cleanup = network.taps.get(edge.id);
      if (cleanup) {
        cleanup();
        network.taps.set({ [edge.id]: null });
      }
    });
  }, [network.connections, network.taps]);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    network.positions.set({ [node.id]: node.position });
  }, [network.positions]);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header with view selector */}
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div className="font-medium text-sm text-gray-700">
          {label || 'Canvas View'}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            <span>Nodes: {reactNodes.length}</span>
            <span className="ml-3">Edges: {reactEdges.length}</span>
          </div>
          <select
            value={currentView}
            onChange={(e) => currentViewCell.receive(e.target.value)}
            className="px-3 py-1 text-sm border rounded bg-white"
          >
            {Object.keys(viewsData).map(id => (
              <option key={id} value={id}>
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </option>
            ))}
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
      </div>
    </div>
  );
}

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
      'c': 'min',  // Make one node min type to test filtering
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

    // Create views table with predefined views
    const viewsTable = table.first<ViewFn>({});
    viewsTable.set({
      'all': allView,
      'maxOnly': typeFilterView(new Set(['max'])),
      'minOnly': typeFilterView(new Set(['min'])),
    });

    // Create left canvas view system (starts with 'all' view)
    const leftView = createCanvasViewSystem(
      positions!,
      nodeTypes!,
      gadgets!,
      connections!,
      viewsTable,
      'all'
    );

    // Create right canvas view system (starts with 'maxOnly' view)
    const rightView = createCanvasViewSystem(
      positions!,
      nodeTypes!,
      gadgets!,
      connections!,
      viewsTable,
      'maxOnly'
    );

    return {
      net,
      nodeTypes,
      positions,
      gadgets,
      connections,
      taps,
      viewsTable,
      currentViewLeft: leftView.currentViewId,
      visualStateLeft: leftView.visualState,
      currentViewRight: rightView.currentViewId,
      visualStateRight: rightView.visualState,
    };
  }, []);

  return (
    <div className="h-screen w-screen flex">
      <CanvasView
        visualState={network.visualStateLeft}
        currentViewId={network.currentViewLeft}
        viewsTable={network.viewsTable}
        network={{
          positions: network.positions,
          connections: network.connections,
          taps: network.taps,
        }}
        label="Left View"
      />

      <div className="w-1 bg-gray-300" />

      <CanvasView
        visualState={network.visualStateRight}
        currentViewId={network.currentViewRight}
        viewsTable={network.viewsTable}
        network={{
          positions: network.positions,
          connections: network.connections,
          taps: network.taps,
        }}
        label="Right View"
      />
    </div>
  );
}
