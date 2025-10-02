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
type Helper<T> = {
  Cell: SweetCell<T> & Implements<Valued<T>>;
  Table: SweetTable<T> & Implements<Table<string, T>>;
}


// Node row type - each property is a gadget with its own merge semantics
type NodeRow = {
  position: Helper<XYPosition>['Cell'],  // cells.last - mutable
  nodeType: Helper<NodeType>['Cell'],  // cells.first - immutable
  value: Helper<number>['Cell'],  // cells.max/min - accumulating
};

// Flattened node values
type NodeValues = {
  position: XYPosition;
  nodeType: NodeType;
  value: number;
};

// View system types
type VisualState = {
  nodes: Node[];
  edges: Edge[];
};

function buildVisualState(
  nodeValues: Record<string, NodeValues>,
  connections: Record<string, Connection | null>,
): VisualState {
  // Get node IDs (filtered or all)
  const nodeIds = Object.keys(nodeValues);

  // Build nodes
  const nodes = nodeIds.map(id => {
    const nodeValue = nodeValues[id]!;
    return {
      id,
      position: nodeValue.position,
      type: 'cell' as const,
      data: {
        value: nodeValue.value,
        nodeType: nodeValue.nodeType,
      },
    };
  });

  // Build edges (only if both endpoints visible)
  const visibleNodeSet = new Set(nodeIds);
  const edges = Object.entries(connections)
    .filter(([_, c]) => c !== null)
    .filter(([_, c]) => {
      const conn = c!;
      return visibleNodeSet.has(conn.from) && visibleNodeSet.has(conn.to);
    })
    .map(([id, c]) => {
      const conn = c!;
      return {
        id,
        source: conn.from,
        target: conn.to,
      };
    });

  return { nodes, edges };
}

// Cell Node Component
function CellNode({ data }: { data: { value: number; nodeType: NodeType } }) {
  return (
    <>
      <Handle id='out' position={Position.Right} type="source" />
      <div className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg shadow-md min-w-[120px]">
        <div className="text-xs font-semibold text-slate-500 mb-2">
          {data.nodeType.toUpperCase()} CELL
        </div>
        <div className="text-2xl font-bold text-center mb-2">{data.value}</div>
      </div>
      <Handle id='in' position={Position.Left} type="target" />
    </>
  );
}

const nodeTypes: NodeTypes = {
  cell: CellNode,
};

// Reusable Canvas View Component
interface CanvasViewProps {
  currentViewId: Helper<string>['Cell'];
  views: Helper<Helper<VisualState>['Cell']>['Table'];
  network: {
    nodes: Helper<NodeRow>['Table'];
    connections: Helper<Connection | null>['Table'];
    taps: Helper<Cleanup>['Table'];
  }
  label?: string;
}

function CanvasView({
  currentViewId,
  views,
  network,
  label
}: CanvasViewProps) {
  // Get current view ID
  const [viewId, viewIdCell] = useGadget<string, Helper<string>['Cell']>(currentViewId);

  // Subscribe to that view's computed state
  const [visual] = useGadget<VisualState, Helper<VisualState>['Cell']>(views.get(viewId)!);

  // React Flow's local state (for smooth interactions)
  const [reactNodes, setReactNodes] = useState<Node[]>([]);
  const [reactEdges, setReactEdges] = useState<Edge[]>([]);

  // Sync: Visual state → React state (when network changes)
  useEffect(() => {
    if (visual !== undefined) {
      setReactNodes(visual.nodes);
      setReactEdges(visual.edges);
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
      }
    });
  }, [network.connections, network.taps]);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    // Send new position to the position cell
    network.nodes.get(node.id)?.position.receive(node.position);
  }, [network.nodes]);

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
            value={viewId}
            onChange={(e) => viewIdCell.receive(e.target.value as string)}
            className="px-3 py-1 text-sm border rounded bg-white"
          >
            {Object.keys(views).map(id => (
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
    // Create tables - nodes with per-property gadgets, connections, and taps
    const nodes = table.last<NodeRow>({});
    const connections = table.last<Connection | null>({});
    const taps = table.last<Cleanup>({});
    const views = table.last<Helper<VisualState>['Cell']>({});

    // Initialize test network - each property is a gadget!
    nodes.set({
      'a': {
        position: cells.last<XYPosition>({ x: 100, y: 100 }),
        nodeType: cells.last('max' as NodeType),
        value: cells.max(0),
      },
      'b': {
        position: cells.last({ x: 100, y: 300 }),
        nodeType: cells.last('max' as NodeType),
        value: cells.max(0),
      },
      'c': {
        position: cells.last({ x: 400, y: 200 }),
        nodeType: cells.last('min' as NodeType),
        value: cells.min(Infinity),
      },
    });

    // Initialize connections
    connections.set({
      'a-b': { from: 'a', to: 'b' },
      'c-b': { from: 'c', to: 'b' },
    });

    // Wire up connections - when connection added, tap from.value -> to.value
    connections.whenAdded((id, conn) => {
      if (conn) {
        const fromNode = nodes.get(conn.from);
        const toNode = nodes.get(conn.to);
        if (fromNode && toNode) {
          const cleanup = fromNode.value.tap(({ changed }) => {
            if (changed !== undefined) {
              toNode.value.receive(changed);
            }
          });
          taps.set({ [id]: cleanup });
        }
      }
    });

    // Flatten nodes - subscribes to all property gadgets
    const [nodeValues, cleanupNodes] = table.flattenTable(nodes) as [Helper<NodeValues>['Table'], Cleanup];

    // Current view selectors
    const currentViewLeft = cells.last<string>('all');
    const currentViewRight = cells.last<string>('maxOnly');

    return {
      nodes,
      nodeValues,
      connections,
      taps,
      views,
      currentViewLeft,
      currentViewRight,
    };
  }, []);

  return (
    <div className="h-screen w-screen flex">
      <CanvasView
        currentViewId={network.currentViewLeft}
        views={network.views}
        network={{
          nodes: network.nodes,
          connections: network.connections,
          taps: network.taps,
        }}
        label="Left View"
      />

      <div className="w-1 bg-gray-300" />

      <CanvasView
        currentViewId={network.currentViewRight}
        views={network.views}
        network={{
          nodes: network.nodes,
          connections: network.connections,
          taps: network.taps,
        }}
        label="Right View"
      />
    </div>
  );
}