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
import { table, cells, setMetadata } from 'port-graphs';
import type { SweetTable, SweetCell, Implements, Cleanup, Tappable, Metadata } from 'port-graphs';
import type { Table, Valued } from 'port-graphs/protocols';
import { useGadget } from "port-graphs-react";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Canvas Demo - Bassline" },
    { name: "description", content: "Visual gadget network canvas" },
  ];
}

type Pos = { x: number, y: number }
type NodeType = 'max' | 'min' | 'union'
type SCell<T> = Implements<Valued<T>> & SweetCell<T> & Metadata;
type STable<T> = Implements<Table<string, T>> & SweetTable<T>;
type Dims = { width: number, height: number };

// Nodes are just gadgets with metadata
// Metadata contains UI info (position, type, dims, etc.)
type NodeGadget = SCell<any>;

// Edge data tracks connections
type EdgeData = {
  from: string,
  to: string,
  cleanup?: () => void
}

// Factory metadata
type FactoryInfo = {
  name: string,
  type: NodeType,
  icon: string,
  category: string,
  description: string,
  initialValue: any,
  create: (pos: Pos) => NodeGadget,
}

// Metadata Inspector Component
function MetadataInspector({ gadget }: { gadget: NodeGadget }) {
  const [metaTable] = useGadget(gadget.metadata, ['changed']);

  if (!metaTable || Object.keys(metaTable).length === 0) {
    return <div className="text-sm text-gray-500">No metadata</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-700">Metadata</div>
      {Object.entries(metaTable).map(([key, cell]) => {
        const value = (cell as any).current();
        return (
          <div key={key} className="text-xs">
            <span className="font-mono text-gray-600">{key}</span>
            <span className="text-gray-400 mx-1">:</span>
            <span className="text-gray-800">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Cell Node Component
function CellNode({ data }: { data: { gadget: NodeGadget, type: NodeType, value: any } }) {
  const { gadget, type, value } = data;

  return (
    <>
      <Handle id='out' position={Position.Right} type="source" />
      <div className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg shadow-md min-w-[120px]">
        <div className="text-xs font-semibold text-slate-500 mb-2">
          {type.toUpperCase()} CELL
        </div>
        <div className="text-2xl font-bold text-center mb-2">{String(value)}</div>
        <button
          onClick={() => {
            gadget.receive(gadget.current() + 1);
          }}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          +1
        </button>
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
  nodes,
  edges,
  factories,
}: {
  nodes: STable<NodeGadget>,
  edges: STable<EdgeData>,
  factories: FactoryInfo[]
}) {
  const [reactNodes, setReactNodes] = useState<Node[]>([]);
  const [reactEdges, setReactEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Watch nodes table for changes
  const [nodesState] = useGadget(nodes, ['added', 'changed']);

  // Build React Flow nodes from gadgets + metadata
  useEffect(() => {
    const nodeEntries = Object.entries(nodesState);

    setReactNodes(old =>
      nodeEntries.map(([id, gadget]) => {
        const existing = old.find(n => n.id === id);
        const position = (gadget as NodeGadget).metadata.get('ui/position')?.current() as XYPosition;
        const type = (gadget as NodeGadget).metadata.get('ui/type')?.current() as NodeType;
        const value = (gadget as NodeGadget).current();

        return {
          ...existing,
          id,
          position: position || { x: 0, y: 0 },
          type: type || 'max',
          data: { gadget, type, value }
        };
      })
    );
  }, [nodesState]);

  // Watch edges table
  const [edgesState] = useGadget(edges, ['added', 'changed']);

  useEffect(() => {
    setReactEdges(old =>
      Object.entries(edgesState).map(([id, edgeData]) => {
        const existing = old.find(e => e.id === id);
        return {
          ...existing,
          id,
          source: (edgeData as EdgeData).from,
          target: (edgeData as EdgeData).to
        } as Edge;
      })
    );
  }, [edgesState]);

  const onConnect = useCallback((connection: ReactFlowConnection) => {
    if (!connection.source || !connection.target) return;
    const id = `${connection.source}-${connection.target}`;

    // Create edge with cleanup
    const edge: EdgeData = {
      from: connection.source,
      to: connection.target,
    };

    edges.set({ [id]: edge });

    // Setup sync
    const sourceGadget = nodes.get(connection.source);
    const targetGadget = nodes.get(connection.target);
    if (sourceGadget && targetGadget) {
      const cleanup = sourceGadget.sync(targetGadget);
      edges.get(id)!.cleanup = cleanup;
    }
  }, [edges, nodes]);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach(e => {
      const edge = edges.get(e.id);
      if (edge?.cleanup) {
        edge.cleanup();
      }
    });
  }, [edges]);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    const gadget = nodes.get(node.id);
    if (gadget) {
      gadget.metadata.get('ui/position')?.receive(node.position);
    }
  }, [nodes]);

  const onNodeClick = useCallback((_event: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const selectedGadget = selectedNodeId ? nodes.get(selectedNodeId) : null;

  return (
    <div className="flex-1 flex h-full">
      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
          <div className="font-medium text-sm text-gray-700">
            Canvas
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              <span>Nodes: {reactNodes.length}</span>
              <span className="ml-3">Edges: {reactEdges.length}</span>
            </div>
            <div className="flex gap-2">
              {factories.map((factory) => (
                <button
                  key={factory.type}
                  onClick={() => createNode(factory, { x: 200, y: 200 })}
                  className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-100 flex items-center gap-1"
                  title={factory.description}
                >
                  <span>{factory.icon}</span>
                  <span>{factory.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

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
            onNodeClick={onNodeClick}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>

      {/* Inspector Panel */}
      <div className="w-80 border-l bg-white flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b bg-gray-50 font-medium text-sm">
          Inspector
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {selectedNodeId && selectedGadget ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Node ID</div>
                <div className="text-sm font-mono">{selectedNodeId}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Current Value</div>
                <div className="text-lg font-bold">{String(selectedGadget.current())}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Type</div>
                <div className="text-sm">
                  {selectedGadget.metadata.get('meta/type')?.current()}
                </div>
              </div>
              <MetadataInspector gadget={selectedGadget} />
            </div>
          ) : (
            <div className="text-sm text-gray-500">Click a node to inspect</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Factory definitions with metadata
const factories: FactoryInfo[] = [
  {
    name: 'Max Cell',
    type: 'max',
    icon: '📈',
    category: 'cell/numeric',
    description: 'Monotonically increasing number',
    initialValue: 0,
    create: (pos: Pos) => {
      const gadget = cells.max(0);
      setMetadata(gadget, 'ui/', {
        position: pos,
        type: 'max',
        dims: { width: 100, height: 100 },
      });
      return gadget;
    }
  },
  {
    name: 'Min Cell',
    type: 'min',
    icon: '📉',
    category: 'cell/numeric',
    description: 'Monotonically decreasing number',
    initialValue: 100,
    create: (pos: Pos) => {
      const gadget = cells.min(100);
      setMetadata(gadget, 'ui/', {
        position: pos,
        type: 'min',
        dims: { width: 100, height: 100 },
      });
      return gadget;
    }
  },
  {
    name: 'Union Cell',
    type: 'union',
    icon: '∪',
    category: 'cell/set',
    description: 'Set union - always grows',
    initialValue: new Set(),
    create: (pos: Pos) => {
      const gadget = cells.union([]);
      setMetadata(gadget, 'ui/', {
        position: pos,
        type: 'union',
        dims: { width: 100, height: 100 },
      });
      return gadget;
    }
  },
];

// Nodes table: name → gadget (with metadata)
const nodes = table.first<NodeGadget>({});

// Edges table: id → {from, to, cleanup?}
const edges = table.first<EdgeData>({});

// Initialize some nodes
const initNodes: Record<string, NodeGadget> = {
  'a': factories[0].create({ x: 100, y: 100 }),
  'b': factories[0].create({ x: 100, y: 300 }),
  'c': factories[0].create({ x: 400, y: 200 }),
};

nodes.set(initNodes);

// Initialize connections
edges.set({
  'a-b': { from: 'a', to: 'b' },
  'c-b': { from: 'c', to: 'b' },
});

// Setup syncs for initial edges
const aGadget = nodes.get('a')!;
const bGadget = nodes.get('b')!;
const cGadget = nodes.get('c')!;

edges.get('a-b')!.cleanup = aGadget.sync(bGadget);
edges.get('c-b')!.cleanup = cGadget.sync(bGadget);

// Helper: Create a new node using a factory
let nodeCounter = 3;
function createNode(factory: FactoryInfo, position: Pos) {
  const nodeId = `node_${nodeCounter++}`;
  const gadget = factory.create(position);
  nodes.set({ [nodeId]: gadget });
  return nodeId;
}

export default function CanvasDemo() {
  return (
    <div className="h-screen w-screen flex">
      <CanvasView
        nodes={nodes}
        edges={edges}
        factories={factories}
      />
    </div>
  );
}
