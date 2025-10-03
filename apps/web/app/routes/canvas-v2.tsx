import type { Route } from "./+types/canvas-v2";
import { useCallback, useState, useEffect } from 'react';
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
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { table, cells, setMetadata } from 'port-graphs';
import type { SweetTable, SweetCell, Implements, Metadata } from 'port-graphs';
import type { Table, Valued } from 'port-graphs/protocols';
import { useGadget } from "port-graphs-react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Canvas V2 - Bassline" },
    { name: "description", content: "Clean metadata-driven canvas" },
  ];
}

// Types
type Pos = { x: number, y: number };
type NodeType = 'max' | 'min' | 'union';
type Connection = { from: string, to: string };

type SCell<T> = Implements<Valued<T>> & SweetCell<T> & Metadata;
type NodeCell = SCell<any>;
type EdgeCell = SCell<Connection>;

// Factories
type Factory = {
  name: string,
  type: NodeType,
  icon: string,
  create: (pos: Pos) => NodeCell,
};

const factories: Factory[] = [
  {
    name: 'Max',
    type: 'max',
    icon: '📈',
    create: (pos) => {
      const gadget = cells.max(0);
      setMetadata(gadget, 'ui/', {
        position: pos,
        type: 'max',
      });
      return gadget;
    }
  },
  {
    name: 'Min',
    type: 'min',
    icon: '📉',
    create: (pos) => {
      const gadget = cells.min(100);
      setMetadata(gadget, 'ui/', {
        position: pos,
        type: 'min',
      });
      return gadget;
    }
  },
  {
    name: 'Union',
    type: 'union',
    icon: '∪',
    create: (pos) => {
      const gadget = cells.union([]);
      setMetadata(gadget, 'ui/', {
        position: pos,
        type: 'union',
      });
      return gadget;
    }
  },
];

// Cell Node Component
function CellNode({ data }: { data: { nodeCell: NodeCell, nodeId: string } }) {
  const { nodeCell, nodeId } = data;
  const [value] = useGadget(nodeCell, ['changed']);
  const type = nodeCell.metadata.get('ui/type')?.current() as NodeType;

  return (
    <>
      <Handle id='out' position={Position.Right} type="source" />
      <div className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg shadow-md min-w-[120px]">
        <div className="text-xs font-semibold text-slate-500 mb-2">
          {type?.toUpperCase()} CELL
        </div>
        <div className="text-2xl font-bold text-center mb-2">
          {type === 'union' ? `Set(${(value as Set<any>).size})` : String(value)}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => {
              if (type === 'union') {
                const newSet = new Set(value);
                newSet.add(Math.random());
                nodeCell.receive(newSet);
              } else {
                nodeCell.receive(value + 1);
              }
            }}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            +1
          </button>
        </div>
      </div>
      <Handle id='in' position={Position.Left} type="target" />
    </>
  );
}

// Metadata Inspector
function MetadataInspector({ nodeCell }: { nodeCell: NodeCell }) {
  const [metaSnapshot, setMetaSnapshot] = useState<Record<string, any>>({});

  useEffect(() => {
    const updateMeta = () => {
      const snapshot = nodeCell.metadata.query()
        .map(cell => cell.current())
        .table;
      setMetaSnapshot(snapshot);
    };

    updateMeta();
    return nodeCell.metadata.whenChanged(updateMeta);
  }, [nodeCell]);

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-700">Metadata</div>
      {Object.entries(metaSnapshot).map(([key, value]) => (
        <div key={key} className="text-xs">
          <span className="font-mono text-gray-600">{key}</span>
          <span className="text-gray-400 mx-1">:</span>
          <span className="text-gray-800">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  cell: CellNode,
};

// Main Canvas Component
function Canvas({
  nodes,
  edges
}: {
  nodes: Implements<Table<string, NodeCell>> & SweetTable<NodeCell>,
  edges: Implements<Table<string, EdgeCell>> & SweetTable<EdgeCell>
}) {
  const [reactNodes, setReactNodes] = useState<Node[]>([]);
  const [reactEdges, setReactEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Watch for new nodes
  useEffect(() => {
    return nodes.whenAdded((id, nodeCell) => {
      const pos = nodeCell.metadata.get('ui/position')?.current() as Pos;
      const type = nodeCell.metadata.get('ui/type')?.current() as NodeType;

      setReactNodes(old => [...old, {
        id,
        position: pos || { x: 0, y: 0 },
        type: 'cell',
        data: { nodeCell, nodeId: id }
      }]);
    });
  }, []);

  // Watch for node value changes
  useEffect(() => {
    return nodes.whenChanged(() => {
      const snapshot = nodes.query().table;
      setReactNodes(old => old.map(node => ({
        ...node,
        data: {
          ...node.data,
          value: snapshot[node.id]?.current()
        }
      })));
    });
  }, []);

  // Watch for new edges
  useEffect(() => {
    return edges.whenAdded((id, edgeCell) => {
      const conn = edgeCell.current();
      const source = nodes.get(conn.from);
      const target = nodes.get(conn.to);

      if (source && target) {
        const cleanup = source.provide(target);
        // Store cleanup in edge metadata
        edgeCell.metadata?.set({
          'edge/cleanup': cells.last(cleanup)
        });
      }

      setReactEdges(old => [...old, {
        id,
        source: conn.from,
        target: conn.to
      }]);
    });
  }, []);

  const onConnect = useCallback((connection: ReactFlowConnection) => {
    if (!connection.source || !connection.target) return;
    const id = `${connection.source}-${connection.target}`;
    edges.set({ [id]: cells.last({ from: connection.source, to: connection.target }) });
  }, []);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach(e => {
      const edgeCell = edges.get(e.id);
      const cleanupCell = edgeCell?.metadata?.get('edge/cleanup');
      const cleanup = cleanupCell?.current() as (() => void) | undefined;
      if (cleanup) cleanup();
    });
  }, []);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    const nodeCell = nodes.get(node.id);
    nodeCell?.metadata.get('ui/position')?.receive(node.position);
  }, []);

  const onNodeClick = useCallback((_event: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : null;

  return (
    <div className="flex-1 flex h-full">
      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
          <div className="font-medium text-sm text-gray-700">Canvas V2</div>
          <div className="flex gap-2">
            {factories.map((factory) => (
              <button
                key={factory.type}
                onClick={() => createNode(factory, { x: 200, y: 200 })}
                className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-100 flex items-center gap-1"
              >
                <span>{factory.icon}</span>
                <span>{factory.name}</span>
              </button>
            ))}
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
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Node ID</div>
                <div className="text-sm font-mono">{selectedNodeId}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Current Value</div>
                <div className="text-lg font-bold">
                  {String(selectedNode.current())}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Type</div>
                <div className="text-sm">
                  {selectedNode.metadata.get('meta/type')?.current()}
                </div>
              </div>
              <MetadataInspector nodeCell={selectedNode} />
            </div>
          ) : (
            <div className="text-sm text-gray-500">Click a node to inspect</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Global tables
const nodes = table.first<NodeCell>({});
const edges = table.first<EdgeCell>({});

// Initialize
const initNodes: Record<string, NodeCell> = {
  'a': factories[0].create({ x: 100, y: 100 }),
  'b': factories[0].create({ x: 100, y: 300 }),
  'c': factories[0].create({ x: 400, y: 200 }),
};
nodes.set(initNodes);

// Initialize edges
edges.set({
  'a-b': cells.last({ from: 'a', to: 'b' }),
  'c-b': cells.last({ from: 'c', to: 'b' }),
});

// Helper
let nodeCounter = 3;
function createNode(factory: Factory, position: Pos) {
  const nodeId = `node_${nodeCounter++}`;
  const nodeCell = factory.create(position);
  nodes.set({ [nodeId]: nodeCell });
  return nodeId;
}

export default function CanvasV2() {
  return (
    <div className="h-screen w-screen flex">
      <Canvas nodes={nodes} edges={edges} />
    </div>
  );
}
