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
import type { SweetTable, SweetCell, Implements, Cleanup, Tappable } from 'port-graphs';
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
type SCell<T> = Implements<Valued<T>> & SweetCell<T>;
type STable<T> = Implements<Table<string, T>> & SweetTable<T>;
type Dims = { width: number, height: number };
type NodeValue = {
  position: Pos,
  type: NodeType,
  dims: Dims,
  gadget: SCell<any>
}
type NodeRow = {
  position: SCell<Pos>,
  type: SCell<NodeType>,
  dims: SCell<Dims>,
  gadget: SCell<any>,
}
type EdgeRow = {
  from: SCell<string>,
  to: SCell<string>,
  cleanup?: () => void
}
type EdgeValue = {
  from: string,
  to: string,
}
type FactoryRow = {
  name: SCell<string>,
  type: SCell<NodeType>,
  icon: SCell<string>,
  initialValue: SCell<any>,
  create: SCell<(pos: Pos) => NodeRow>,
}
type FactoryValue = {
  name: string,
  type: NodeType,
  icon: string,
  initialValue: any,
  create: (pos: Pos) => NodeRow,
}

// Cell Node Component
function CellNode({ data: { gadget, type, originalGadget } }: { data: NodeValue & { originalGadget: SCell<unknown> } }) {
  return (
    <>
      <Handle id='out' position={Position.Right} type="source" />
      <div className="px-4 py-3 bg-white border-2 border-slate-300 rounded-lg shadow-md min-w-[120px]">
        <div className="text-xs font-semibold text-slate-500 mb-2">
          {type.toUpperCase()} CELL
        </div>
        <div className="text-2xl font-bold text-center mb-2">{gadget}</div>
        <button
          onClick={() => {
            originalGadget.receive(originalGadget.current() + 1);
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
  nodeValues,
  nodes,
  edges,
  edgeValues,
  factories,
}: {
  nodeValues: Record<string, NodeValue>,
  nodes: STable<NodeRow>,
  edges: STable<EdgeRow>,
  edgeValues: Record<string, EdgeValue>,
  factories: Record<string, FactoryValue>
}) {
  const [reactNodes, setReactNodes] = useState<Node[]>([]);
  const [reactEdges, setReactEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setReactNodes(old =>
      Object.entries(nodeValues).map(([k, v]) => {
        const existing = old.find(n => n.id === k);
        return {
          ...existing,
          id: k,
          position: v.position as XYPosition,
          type: v.type,
          data: { ...v, originalGadget: nodes.get(k)!.gadget }
        };
      })
    );
  }, [nodeValues, nodes]);

  useEffect(() => {
    setReactEdges(old =>
      Object.entries(edgeValues).map(([k, v]) => {
        const existing = old.find(e => e.id === k);
        return {
          ...existing,
          id: k,
          source: v.from,
          target: v.to
        } as Edge;
      })
    );
  }, [edgeValues]);

  // // Interaction handlers (forward to network)
  const onConnect = useCallback((connection: ReactFlowConnection) => {
    if (!connection.source || !connection.target) return;
    const id = `${connection.source}-${connection.target}`;
    edges.receive({
      [id]: {
        from: cells.last(connection.source),
        to: cells.last(connection.target),
      }
    });
  }, [edges]);

  const onEdgesDelete = useCallback((e: Edge[]) => {
    e.forEach(e => {
      const edge = edges.get(e.id)!;
      const { from, to, cleanup } = edge;
      from.receive('idk');
      to.receive('idk');
      if (cleanup) {
        console.log('Cleaning up connection!');
        cleanup();
        delete edge.cleanup;
      }
    });
  }, [edges]);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    // Send new position to the position cell
    nodes.get(node.id)?.position.receive(node.position);
  }, [nodes]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div className="font-medium text-sm text-gray-700">
          'Canvas'
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            <span>Nodes: {reactNodes.length}</span>
            <span className="ml-3">Edges: {reactEdges.length}</span>
          </div>
          <div className="flex gap-2">
            {Object.entries(factories).map(([id, factory]) => (
              <button
                key={id}
                onClick={() => createNode(id, { x: 200, y: 200 })}
                className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-100 flex items-center gap-1"
                title={factory.name}
              >
                <span>{factory.icon}</span>
                <span>{factory.type}</span>
              </button>
            ))}
          </div>
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
          //connectionMode={ConnectionMode.Loose}
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


// Factory table - defines what node types can be created
const factories = table.first<FactoryRow>({
  max: {
    name: cells.last('Max Cell'),
    type: cells.last('max' as NodeType),
    icon: cells.last('📈'),
    initialValue: cells.last(0),
    create: cells.last((pos: Pos) => ({
      position: cells.last<XYPosition>(pos as XYPosition),
      type: cells.last('max' as NodeType),
      dims: cells.last<Dims>({ width: 100, height: 100 }),
      gadget: cells.max(0),
    })),
  },
  min: {
    name: cells.last('Min Cell'),
    type: cells.last('min' as NodeType),
    icon: cells.last('📉'),
    initialValue: cells.last(100),
    create: cells.last((pos: Pos) => ({
      position: cells.last<XYPosition>(pos as XYPosition),
      type: cells.last('min' as NodeType),
      dims: cells.last<Dims>({ width: 100, height: 100 }),
      gadget: cells.min(100),
    })),
  },
  union: {
    name: cells.last('Union Cell'),
    type: cells.last('union' as NodeType),
    icon: cells.last('∪'),
    initialValue: cells.last(new Set()),
    create: cells.last((pos: Pos) => ({
      position: cells.last<XYPosition>(pos as XYPosition),
      type: cells.last('union' as NodeType),
      dims: cells.last<Dims>({ width: 100, height: 100 }),
      gadget: cells.union(new Set()),
    })),
  },
});

const [factoryValues] = table.flattenTable<FactoryRow, FactoryValue>(factories);

const nodes = table.first<NodeRow>({} as Record<string, NodeRow>);
const edges = table.first<EdgeRow>({} as Record<string, EdgeRow>);
const [nodeValues, c1] = table.flattenTable<NodeRow, NodeValue>(nodes);
const [edgeValues, c2] = table.flattenTable<EdgeRow, EdgeValue>(edges);
nodeValues.whenAdded((k, v) => {
  // Node added to the flattened view
});

edgeValues.whenAdded((k, v) => {
  const edge = edges.get(k)!
  if (!edge.cleanup) {
    const [from, to] = nodes.getMany([v.from, v.to])!;
    const cleanup = (from?.gadget as SCell<unknown>).sync(to?.gadget as SCell<unknown>);
    edge.cleanup = cleanup;
  }
});
nodes.set({
  'a': {
    position: cells.last<XYPosition>({ x: 100, y: 100 }),
    type: cells.last('max' as NodeType),
    dims: cells.last<Dims>({ width: 100, height: 100 } as Dims),
    gadget: cells.max(0),
  },
  'b': {
    position: cells.last<XYPosition>({ x: 100, y: 300 }),
    type: cells.last('max' as NodeType),
    dims: cells.last<Dims>({ width: 100, height: 100 } as Dims),
    gadget: cells.max(0),
  },
  'c': {
    position: cells.last<XYPosition>({ x: 400, y: 200 }),
    type: cells.last('max' as NodeType),
    dims: cells.last<Dims>({ width: 100, height: 100 } as Dims),
    gadget: cells.max(0),
  },
});

// Initialize connections
edges.set({
  'a-b': { from: cells.last('a'), to: cells.last('b') },
  'c-b': { from: cells.last('c'), to: cells.last('b') },
});

// Helper: Create a new node using a factory
let nodeCounter = 3; // a, b, c already exist
function createNode(factoryId: string, position: Pos) {
  const factory = factories.get(factoryId);
  if (!factory) {
    console.error(`Factory not found: ${factoryId}`);
    return;
  }

  const nodeId = `node_${nodeCounter++}`;
  const nodeRow = factory.create.current()(position);
  nodes.set({ [nodeId]: nodeRow });
  return nodeId;
}

// Helper: Delete a node and clean up its edges
function deleteNode(nodeId: string) {
  // TODO: Clean up edges that reference this node
  // TODO: Call cleanup functions
  // For now, just a placeholder
  console.log(`Delete node: ${nodeId}`);
}

export default function CanvasDemo() {
  const [nodeValueState] = useGadget(nodeValues, ['added', 'changed']);
  const [edgeValueState] = useGadget(edgeValues, ['added', 'changed']);
  const [factoryValueState] = useGadget(factoryValues, ['added', 'changed']);

  return (
    <div className="h-screen w-screen flex">
      <CanvasView
        nodes={nodes}
        nodeValues={nodeValueState}
        edges={edges}
        edgeValues={edgeValueState}
        factories={factoryValueState}
      />

      <div className="w-1 bg-gray-300" />
    </div>
  );
}