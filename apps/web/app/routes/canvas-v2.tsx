import type { Route } from "./+types/canvas-v2";
import { useCallback, useState, useEffect } from 'react';
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
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { table, cells, setMetadata } from 'port-graphs';
import type { SweetTable, SweetCell, Implements, Metadata } from 'port-graphs';
import type { Table, Valued } from 'port-graphs/protocols';
import { useGadget } from "port-graphs-react";

export function meta({ }: Route.MetaArgs) {
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

// UI state cells
const selection = cells.last<string | null>(null);
const inspectorTab = cells.last<'value' | 'metadata' | 'connections'>('value');
const inspectorCollapsed = cells.last(false);
const inspector = cells.last<{ target: (NodeCell | SCell<any>) | null }>({ target: null });

// Root table - unified namespace for everything in the system
const root = table.first<NodeCell | SCell<any>>({
  // Factory prototypes
  'factory/max': cells.max(0),
  'factory/min': cells.min(100),
  'factory/union': cells.union([]),
  'factory/intersection': cells.intersection([]),
  'factory/ordinal': cells.ordinal(0),
  'factory/last': cells.last(0),
  'factory/inspector': cells.inspector({ target: null }),

  // UI state
  'ui/selection': selection,
  'ui/inspector': inspector,
  'ui/inspector/tab': inspectorTab,
  'ui/inspector/collapsed': inspectorCollapsed,
});

// Cell Node Component
function CellNode({ data }: { data: { nodeCell: NodeCell, nodeId: string } }) {
  const { nodeCell, nodeId } = data;
  const [value] = useGadget(nodeCell, ['changed']);
  const [selectedKey] = useGadget(selection);
  const type = nodeCell.metadata.get('ui/type')?.current() as NodeType;
  const isSelected = selectedKey === nodeId;

  return (
    <>
      <Handle id='out' position={Position.Right} type="source" />
      <div className={`px-4 py-3 bg-white border-2 rounded-lg shadow-md min-w-[120px] transition-all ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 border-blue-500' : 'border-slate-300'
        }`}>
        <div className="text-xs font-semibold text-slate-500 mb-2">
          {type?.toUpperCase()} CELL
        </div>
        <div className="text-2xl font-bold text-center mb-2">
          {type === 'union' ? `Set(${(value as Set<any>).size})` : String(value)}
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
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

// Inspector Node Component - renders inspector as a canvas node
function InspectorNode({ data }: { data: { nodeCell: NodeCell, nodeId: string } }) {
  const { nodeCell: inspectorGadget, nodeId } = data;
  const [selectedKey] = useGadget(selection);

  // Watch inspector's state (what it's targeting)
  const [inspectorState, setInspectorState] = useState<{ target: any }>({ target: null });
  const [targetValue, setTargetValue] = useState<any>(null);
  const [metaSnapshot, setMetaSnapshot] = useState<Record<string, any>>({});

  // Watch inspector's value
  useEffect(() => {
    const update = () => setInspectorState(inspectorGadget.current());
    update();
    return inspectorGadget.tap(update);
  }, [inspectorGadget]);

  const targetGadget = inspectorState?.target;

  // Watch target's value and metadata
  useEffect(() => {
    if (!targetGadget) {
      setTargetValue(null);
      setMetaSnapshot({});
      return;
    }

    const updateValue = () => setTargetValue(targetGadget.current());
    updateValue();
    const valueCleanup = targetGadget.tap(updateValue);

    if (targetGadget.metadata) {
      const updateMeta = () => {
        const snapshot = targetGadget.metadata.query().map(c => c.current()).table;
        setMetaSnapshot(snapshot);
      };
      updateMeta();
      const metaCleanup = targetGadget.metadata.whenChanged(updateMeta);
      return () => {
        valueCleanup();
        metaCleanup();
      };
    }

    return valueCleanup;
  }, [targetGadget]);

  // Helper to find key in root
  const findKeyInRoot = (gadget: any): string | null => {
    const snapshot = root.query().table;
    for (const [key, cell] of Object.entries(snapshot)) {
      if (cell === gadget) return key;
    }
    return null;
  };

  const isSelected = selectedKey === nodeId;

  return (
    <>
      <Handle position={Position.Right} type="source" id="out" />
      <div className={`px-3 py-2 bg-purple-50 border-2 rounded-lg shadow-lg min-w-[200px] max-w-[300px] transition-all ${isSelected ? 'ring-2 ring-purple-500 ring-offset-2 border-purple-500' : 'border-purple-300'
        }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🔍</span>
          <span className="text-xs font-bold text-purple-700">INSPECTOR</span>
        </div>

        {targetGadget ? (
          <div className="space-y-1 text-xs">
            <div className="font-mono text-purple-900 truncate text-[10px]">
              {findKeyInRoot(targetGadget) || 'metadata cell'}
            </div>
            <div className="text-purple-700 truncate">
              {String(targetValue).substring(0, 40)}
            </div>
            <div className="text-purple-600 text-[10px]">
              {Object.keys(metaSnapshot).length} metadata fields
            </div>

            {/* Metadata rows - clickable to update THIS inspector */}
            <div className="max-h-24 overflow-y-auto space-y-0.5 mt-1">
              {Object.entries(metaSnapshot).slice(0, 5).map(([key, val]) => (
                <div
                  key={key}
                  className="text-[10px] cursor-pointer hover:bg-purple-200 p-0.5 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    const metaCell = targetGadget.metadata?.get(key);
                    if (metaCell) {
                      inspectorGadget.receive({ target: metaCell });
                    }
                  }}
                  title="Click to inspect this metadata cell"
                >
                  <span className="font-mono">{key}</span>: {String(val).substring(0, 15)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-purple-500">
            No target selected
          </div>
        )}
      </div>
      <Handle position={Position.Left} type="target" id="in" />
    </>
  );
}

const nodeTypes: NodeTypes = {
  cell: CellNode,
  inspector: InspectorNode,
};

// Inspector Panel Component with proper reactivity
function InspectorPanel({
  inspector,
  selectedKey,
  targetGadget,
  root
}: {
  inspector: SCell<{ target: (NodeCell | SCell<any>) | null }>,
  selectedKey: string | null,
  targetGadget: (NodeCell | SCell<any>) | null,
  root: ReturnType<typeof table.first<NodeCell | SCell<any>>>
}) {
  // Watch target's metadata for live updates
  const [metaSnapshot, setMetaSnapshot] = useState<Record<string, any>>({});
  const [targetValue, setTargetValue] = useState<any>(null);

  useEffect(() => {
    if (!targetGadget) {
      setMetaSnapshot({});
      setTargetValue(null);
      return;
    }

    // Watch the target's value
    const updateValue = () => {
      setTargetValue(targetGadget.current());
    };
    updateValue();
    const valueCleanup = targetGadget.tap(() => updateValue());

    // Watch target's metadata
    if (targetGadget.metadata) {
      const updateMeta = () => {
        const snapshot = targetGadget.metadata.query()
          .map(cell => cell.current())
          .table;
        setMetaSnapshot(snapshot);
      };
      updateMeta();
      const metaCleanup = targetGadget.metadata.whenChanged(updateMeta);

      return () => {
        valueCleanup();
        metaCleanup();
      };
    }

    return valueCleanup;
  }, [targetGadget]);

  const handlePopOut = useCallback(() => {
    // Get the factory and create a new inspector
    const factory = root.get('factory/inspector') as NodeCell;
    const factoryFn = factory.metadata.get('ui/factory')?.current() as (pos: { x: number, y: number }) => NodeCell;

    if (factoryFn) {
      // Create at center of viewport
      const newInspector = factoryFn({ x: 400, y: 300 });

      // Set it to inspect the current target
      if (targetGadget) {
        newInspector.receive({ target: targetGadget });
      }

      // Add to root
      const nodeId = `node/${Date.now()}`;
      root.receive({ [nodeId]: newInspector });
    }
  }, [targetGadget]);

  return (
    <div className="w-80 border-l bg-white flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div
          className="font-medium text-sm cursor-pointer hover:text-gray-700"
          onClick={() => {
            const inspectorGadget = root.get('ui/inspector') as NodeCell;
            inspector.receive({ target: inspectorGadget });
          }}
          title="Click to inspect the inspector itself"
        >
          Inspector {selectedKey && `(${selectedKey})`}
        </div>
        <button
          onClick={handlePopOut}
          className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
          title="Pop out as canvas node"
        >
          🔍 Pop Out
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {targetGadget ? (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Inspecting</div>
              <div className="text-sm font-mono">{selectedKey || 'metadata cell'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Current Value</div>
              <div className="text-lg font-bold">
                {typeof targetValue === 'object' && targetValue !== null
                  ? JSON.stringify(targetValue)
                  : String(targetValue)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Type</div>
              <div className="text-sm">
                {targetGadget.metadata?.get?.('meta/type')?.current() || 'unknown'}
              </div>
            </div>
            {targetGadget.metadata && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700">Metadata</div>
                {Object.entries(metaSnapshot).map(([key, value]) => (
                  <div
                    key={key}
                    className="text-xs cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors"
                    onClick={() => {
                      // Get the specific metadata cell and inspect it
                      const metadataCell = targetGadget.metadata?.get(key);
                      if (metadataCell) {
                        inspector.receive({ target: metadataCell });
                      }
                    }}
                    title="Click to inspect this metadata cell"
                  >
                    <span className="font-mono text-gray-600">{key}</span>
                    <span className="text-gray-400 mx-1">:</span>
                    <span className="text-gray-800">
                      {typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Click anything to inspect it
            <div className="mt-4 space-y-1">
              <div
                className="text-xs text-blue-600 cursor-pointer hover:underline"
                onClick={() => {
                  const tabCell = root.get('ui/inspector/tab');
                  inspector.receive({ target: tabCell });
                }}
              >
                → Inspect inspector tab cell
              </div>
              <div
                className="text-xs text-blue-600 cursor-pointer hover:underline"
                onClick={() => {
                  const selectionCell = root.get('ui/selection');
                  inspector.receive({ target: selectionCell });
                }}
              >
                → Inspect selection cell
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Canvas Component
function Canvas({
  root
}: {
  root: Implements<Table<string, NodeCell | SCell<any>>> & SweetTable<NodeCell | SCell<any>>
}) {
  const [reactNodes, setReactNodes] = useState<Node[]>([]);
  const [reactEdges, setReactEdges] = useState<Edge[]>([]);

  // Watch for new nodes (namespace: node/*)
  useEffect(() => {
    return root.whenAdded((id, cell) => {
      if (!id.startsWith('node/')) return;

      const nodeCell = cell as NodeCell;
      const pos = nodeCell.metadata.get('ui/position')?.current() as Pos;
      const type = nodeCell.metadata.get('ui/type')?.current() as NodeType;

      setReactNodes(old => [...old, {
        id,
        position: pos || { x: 0, y: 0 },
        type: type === 'inspector' ? 'inspector' : 'cell',
        data: { nodeCell, nodeId: id }
      }]);
    });
  }, []);

  // Watch for node value changes
  useEffect(() => {
    return root.whenChanged((id) => {
      if (!id.startsWith('node/')) return;

      const snapshot = root.query().whereKeys(k => k.startsWith('node/')).table;
      setReactNodes(old => old.map(node => ({
        ...node,
        data: {
          ...node.data,
          value: snapshot[node.id]?.current()
        }
      })));
    });
  }, []);

  // Watch for new edges (namespace: edge/*)
  useEffect(() => {
    return root.whenAdded((id, cell) => {
      if (!id.startsWith('edge/')) return;

      const edgeCell = cell as EdgeCell;
      const conn = edgeCell.current();
      const source = root.get(conn.from) as NodeCell;
      const target = root.get(conn.to) as NodeCell;

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
    const id = `edge/${connection.source}-${connection.target}`;
    root.set({ [id]: cells.last({ from: connection.source, to: connection.target }) });
  }, []);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach(e => {
      const edgeCell = root.get(e.id) as EdgeCell;
      const cleanupCell = edgeCell?.metadata?.get('edge/cleanup');
      const cleanup = cleanupCell?.current() as (() => void) | undefined;
      if (cleanup) cleanup();
    });
  }, []);

  const onNodeDragStop = useCallback((_event: any, node: Node) => {
    const nodeCell = root.get(node.id) as NodeCell;
    nodeCell?.metadata.get('ui/position')?.receive(node.position);
  }, []);

  const onNodeClick = useCallback((_event: any, node: Node) => {
    const nodeGadget = root.get(node.id) as NodeCell;
    selection.receive(node.id);  // Keep selection for visual feedback
    inspector.receive({ target: nodeGadget });  // Set inspector to hold the gadget directly
  }, []);

  // Read selection from the selection cell (for visual feedback)
  const [selectedKey] = useGadget(selection);

  // Read inspector state to get what it's targeting
  const [inspectorState] = useGadget(inspector);
  const targetGadget = inspectorState?.target;

  // Populate inspector's metadata with what it's viewing
  useEffect(() => {
    if (targetGadget?.metadata) {
      // Put viewing state into inspector's own metadata
      inspector.metadata.set({
        'viewing/target': cells.last(selectedKey || 'unknown'),
        'viewing/metadata': targetGadget.metadata  // Reference to the target's metadata table
      });
    } else if (!targetGadget) {
      // Clear viewing metadata when nothing selected
      inspector.metadata.set({
        'viewing/target': cells.last(null),
      });
    }
  }, [targetGadget, selectedKey]);

  // Query factory registry for available factories (namespace: factory/*)
  const [availableFactories, setAvailableFactories] = useState<Array<{
    key: string,
    cell: NodeCell,
    name: string,
    icon: string,
    color: string,
    factory: (pos: Pos) => NodeCell
  }>>([]);

  useEffect(() => {
    const updateFactories = () => {
      const snapshot = root.query().whereKeys(k => k.startsWith('factory/')).table;
      const factories = Object.entries(snapshot)
        .filter(([_, cell]) => cell.metadata.get('ui/factory') !== undefined)
        .map(([key, cell]) => ({
          key,
          cell: cell as NodeCell,
          name: (cell.metadata.get('meta/type')?.current() as string) || key,
          icon: (cell.metadata.get('ui/icon')?.current() as string) || '•',
          color: (cell.metadata.get('ui/color')?.current() as string) || '#6b7280',
          factory: cell.metadata.get('ui/factory')?.current() as (pos: Pos) => NodeCell
        }));
      setAvailableFactories(factories);
    };

    updateFactories();
    return root.whenChanged((id) => {
      if (id.startsWith('factory/')) {
        updateFactories();
      }
    });
  }, []);

  return (
    <div className="flex-1 flex h-full">
      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
          <div className="font-medium text-sm text-gray-700">Canvas V2</div>
          <div className="flex gap-2">
            {availableFactories.map((factory) => (
              <button
                key={factory.key}
                onClick={() => createNode(factory, { x: 200, y: 200 })}
                className="px-3 py-1 text-sm border rounded bg-white hover:bg-gray-100 flex items-center gap-1"
                style={{ borderColor: factory.color }}
              >
                <span>{factory.icon}</span>
                <span className="capitalize">{factory.name}</span>
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
      <InspectorPanel
        inspector={inspector}
        selectedKey={selectedKey}
        targetGadget={targetGadget}
        root={root}
      />
    </div>
  );
}

// Initialize root with node instances and edges
const maxFactory = root.get('factory/max')?.metadata.get('ui/factory')?.current() as (pos: Pos) => NodeCell;
if (maxFactory) {
  root.set({
    'node/a': maxFactory({ x: 100, y: 100 }),
    'node/b': maxFactory({ x: 100, y: 300 }),
    'node/c': maxFactory({ x: 400, y: 200 }),
    'edge/a-b': cells.last({ from: 'node/a', to: 'node/b' }),
    'edge/c-b': cells.last({ from: 'node/c', to: 'node/b' }),
  });
}

// Helper
let nodeCounter = 3;
function createNode(factory: { factory: (pos: Pos) => NodeCell }, position: Pos) {
  const nodeId = `node/node_${nodeCounter++}`;
  const nodeCell = factory.factory(position);
  root.set({ [nodeId]: nodeCell });
  return nodeId;
}

export default function CanvasV2() {
  return (
    <div className="h-screen w-screen flex">
      <Canvas root={root} />
    </div>
  );
}
