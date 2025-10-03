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
import { table, cells, setMetadata, fn, withMetadata } from 'port-graphs';
import type { SweetTable, SweetCell, Implements, Metadata } from 'port-graphs';
import type { Table, Valued } from 'port-graphs/protocols';
import { useGadget } from "port-graphs-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Badge } from "~/components/ui/badge";
import { GadgetValueDisplay } from "~/components/GadgetValueDisplay";
import { GadgetControls } from "~/components/GadgetControls";
import { generateDefaultControls, getControlPresets } from "~/lib/generateControls";

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
  const [selectedKey] = useGadget(selection);
  const type = nodeCell.metadata.get('ui/type')?.current() as NodeType;
  const icon = nodeCell.metadata.get('ui/icon')?.current();
  const isSelected = selectedKey === nodeId;

  const controls = generateDefaultControls(nodeCell);
  const presets = getControlPresets(nodeCell);

  return (
    <>
      <Handle id='out' position={Position.Right} type="source" />
      <div className={`px-4 py-3 bg-white border-2 rounded-lg shadow-md min-w-[180px] max-w-[240px] transition-all ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 border-blue-500' : 'border-slate-300'
        }`}>
        <div className="flex items-center gap-2 mb-3">
          {icon && <span className="text-lg">{icon}</span>}
          <Badge variant="outline" className="text-xs font-semibold">
            {type?.toUpperCase()}
          </Badge>
        </div>
        <div className="mb-3 flex justify-center">
          <GadgetValueDisplay
            gadget={nodeCell}
            options={{ inline: true, truncateLength: 30 }}
          />
        </div>
        <GadgetControls
          gadget={nodeCell}
          controls={controls}
          presets={presets}
          compact
        />
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
      const cellTaps: Array<() => void> = [];

      // Update snapshot without setting up new taps
      const refreshSnapshot = () => {
        const snapshot = targetGadget.metadata.query().map(c => c.current()).table;
        setMetaSnapshot(snapshot);
      };

      // Setup taps on all metadata cells
      const setupTaps = () => {
        // Clean up old cell taps
        cellTaps.forEach(cleanup => cleanup());
        cellTaps.length = 0;

        // Tap each metadata cell for value changes
        Object.values(targetGadget.metadata.query().table).forEach((cell: any) => {
          const tap = cell.tap(() => refreshSnapshot());  // Just refresh, don't re-tap!
          cellTaps.push(tap);
        });
      };

      // Initial setup
      refreshSnapshot();
      setupTaps();

      // When metadata structure changes (cells added/removed), re-setup taps
      const metaCleanup = targetGadget.metadata.whenChanged(() => {
        refreshSnapshot();
        setupTaps();
      });

      return () => {
        valueCleanup();
        metaCleanup();
        cellTaps.forEach(cleanup => cleanup());
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
          <div className="space-y-2 text-xs">
            <div className="font-mono text-purple-900 truncate text-[10px]">
              {findKeyInRoot(targetGadget) || 'metadata cell'}
            </div>

            <div className="bg-white p-2 rounded border border-purple-200">
              <GadgetValueDisplay
                gadget={targetGadget}
                options={{ inline: true, truncateLength: 35 }}
              />
            </div>

            {Object.keys(metaSnapshot).length > 0 && (
              <div>
                <div className="text-purple-600 text-[10px] mb-1">
                  {Object.keys(metaSnapshot).length} metadata fields
                </div>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {Object.entries(metaSnapshot).slice(0, 5).map(([key, val]) => (
                    <div
                      key={key}
                      className="text-[10px] cursor-pointer hover:bg-purple-200 p-1 rounded flex items-start gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        const metaCell = targetGadget.metadata?.get(key);
                        if (metaCell) {
                          inspectorGadget.receive({ target: metaCell });
                        }
                      }}
                      title="Click to inspect this metadata cell"
                    >
                      <span className="font-mono text-purple-700">{key}:</span>
                      <span className="truncate flex-1">{String(val).substring(0, 15)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
      const cellTaps: Array<() => void> = [];

      // Update snapshot without setting up new taps
      const refreshSnapshot = () => {
        const snapshot = targetGadget.metadata.query()
          .map(cell => cell.current())
          .table;
        setMetaSnapshot(snapshot);
      };

      // Setup taps on all metadata cells
      const setupTaps = () => {
        // Clean up old cell taps
        cellTaps.forEach(cleanup => cleanup());
        cellTaps.length = 0;

        // Tap each metadata cell for value changes
        Object.values(targetGadget.metadata.query().table).forEach((cell: any) => {
          const tap = cell.tap(() => refreshSnapshot());  // Just refresh, don't re-tap!
          cellTaps.push(tap);
        });
      };

      // Initial setup
      refreshSnapshot();
      setupTaps();

      // When metadata structure changes (cells added/removed), re-setup taps
      const metaCleanup = targetGadget.metadata.whenChanged(() => {
        refreshSnapshot();
        setupTaps();
      });

      return () => {
        valueCleanup();
        metaCleanup();
        cellTaps.forEach(cleanup => cleanup());
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
              <Badge variant="outline" className="font-mono text-sm">
                {selectedKey || 'metadata cell'}
              </Badge>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-2">Current Value</div>
              <div className="border rounded-lg p-3 bg-gray-50">
                <GadgetValueDisplay
                  gadget={targetGadget}
                  options={{ inline: false, maxDepth: 3 }}
                />
              </div>
            </div>

            {targetGadget.metadata?.get?.('meta/type') && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Type</div>
                <Badge>{targetGadget.metadata.get('meta/type').current()}</Badge>
              </div>
            )}

            <div>
              <div className="text-xs text-gray-500 mb-2">Controls</div>
              <GadgetControls
                gadget={targetGadget}
                controls={generateDefaultControls(targetGadget)}
                presets={getControlPresets(targetGadget)}
              />
            </div>

            {targetGadget.metadata && Object.keys(metaSnapshot).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700">Metadata ({Object.keys(metaSnapshot).length})</div>
                <div className="border rounded-lg overflow-hidden">
                  {Object.entries(metaSnapshot).map(([key, value]) => (
                    <div
                      key={key}
                      className="text-xs cursor-pointer hover:bg-blue-50 p-2 border-b last:border-b-0 transition-colors"
                      onClick={() => {
                        const metadataCell = targetGadget.metadata?.get(key);
                        if (metadataCell) {
                          inspector.receive({ target: metadataCell });
                        }
                      }}
                      title="Click to inspect this metadata cell"
                    >
                      <div className="font-mono text-gray-600 mb-1">{key}</div>
                      <div className="text-gray-800 ml-2">
                        {typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Set)
                          ? <Badge variant="outline">Object</Badge>
                          : typeof value === 'function'
                            ? <Badge variant="outline">Function</Badge>
                            : Array.isArray(value)
                              ? <Badge variant="outline">Array({value.length})</Badge>
                              : value instanceof Set
                                ? <Badge variant="outline">Set({value.size})</Badge>
                                : <span className="font-mono">{String(value)}</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
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

// Command Palette Component
function CommandPalette({
  root,
  selection,
  inspector
}: {
  root: Implements<Table<string, NodeCell | SCell<any>>> & SweetTable<NodeCell | SCell<any>>,
  selection: SCell<string | null>,
  inspector: SCell<{ target: (NodeCell | SCell<any>) | null }>
}) {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);

  // ⌘K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Load all keys from root
  useEffect(() => {
    if (open) {
      const snapshot = root.query().table;
      setKeys(Object.keys(snapshot).sort());
    }
  }, [open, root]);

  // When key selected
  const handleSelect = (key: string) => {
    const gadget = root.get(key);
    if (gadget) {
      // Update selection if it's a node
      if (key.startsWith('node/')) {
        selection.receive(key);
      }
      // Always update inspector
      inspector.receive({ target: gadget });
    }
    setOpen(false);
  };

  // Group keys by namespace prefix
  const keysByNamespace = keys.reduce((acc, key) => {
    const namespace = key.split('/')[0];
    if (!acc[namespace]) acc[namespace] = [];
    acc[namespace].push(key);
    return acc;
  }, {} as Record<string, string[]>);

  const namespaces = Object.keys(keysByNamespace).sort();

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search all gadgets in the system..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {namespaces.map(namespace => (
          <CommandGroup key={namespace} heading={namespace.charAt(0).toUpperCase() + namespace.slice(1)}>
            {keysByNamespace[namespace]?.map(key => {
              const gadget = root.get(key);
              const icon = gadget?.metadata?.get?.('ui/icon')?.current();
              const type = gadget?.metadata?.get?.('ui/type')?.current();

              return (
                <CommandItem
                  key={key}
                  value={key}
                  onSelect={() => handleSelect(key)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {icon && <span>{icon}</span>}
                    <span className="font-mono text-sm flex-1">{key}</span>
                    {type && (
                      <Badge variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
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

  // Pattern Auto-Wiring System
  // Watches pattern/* namespace and creates/manages taps automatically
  useEffect(() => {
    const wirePattern = (patternId: string, patternCell: NodeCell) => {
      const patternData = patternCell.current();
      const { type, source, target, transform } = patternData;

      if (type === 'namespace') {
        // Match all keys in the source namespace pattern
        const matchingKeys = Object.keys(root.query().table).filter(key => {
          // Simple glob matching for patterns like "sensors/*"
          const pattern = source.replace('*', '.*');
          return new RegExp(`^${pattern}$`).test(key);
        });

        // Create taps for each matching source
        const cleanups: Array<() => void> = [];
        matchingKeys.forEach(sourceKey => {
          const sourceGadget = root.get(sourceKey);
          const targetGadget = root.get(target);

          if (sourceGadget && targetGadget) {
            const cleanup = sourceGadget.tap((effects: any) => {
              if (effects.changed !== undefined) {
                const value = transform ? transform(effects.changed) : effects.changed;
                targetGadget.receive(value);
              }
            });
            cleanups.push(cleanup);
          }
        });

        // Store cleanup functions in pattern's metadata
        if (cleanups.length > 0) {
          patternCell.metadata.set({
            'pattern/cleanups': cells.last(cleanups),
            'pattern/active-sources': cells.last(matchingKeys)
          });
        }
      }
    };

    // Wire existing patterns
    const existingPatterns = root.query().whereKeys(k => k.startsWith('pattern/')).table;
    Object.entries(existingPatterns).forEach(([id, cell]) => {
      wirePattern(id, cell as NodeCell);
    });

    // Watch for new patterns
    return root.whenAdded((id, cell) => {
      if (id.startsWith('pattern/')) {
        wirePattern(id, cell as NodeCell);
      }
    });
  }, []);

  // Pattern cleanup on deletion
  useEffect(() => {
    return root.whenRemoved?.((id, cell) => {
      if (id.startsWith('pattern/')) {
        const patternCell = cell as NodeCell;
        const cleanupsCell = patternCell.metadata.get('pattern/cleanups');
        const cleanups = cleanupsCell?.current() as Array<() => void> | undefined;

        if (cleanups) {
          cleanups.forEach(cleanup => cleanup());
        }
      }
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
      {/* Command Palette */}
      <CommandPalette root={root} selection={selection} inspector={inspector} />

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
            <div className="border-l mx-2" />
            <button
              onClick={() => {
                if (!selectedKey) {
                  alert('Select a target node first');
                  return;
                }
                // Create a test pattern: all max cells → selected node
                const patternId = `pattern/${Date.now()}`;
                const pattern = cells.last({
                  type: 'namespace',
                  source: 'factory/max',  // Test: just the max factory
                  target: selectedKey,
                  transform: null
                });
                root.set({ [patternId]: pattern });
              }}
              className="px-3 py-1 text-sm border rounded bg-purple-50 hover:bg-purple-100 border-purple-300 flex items-center gap-1"
              title="Create namespace pattern (test)"
            >
              <span>🔗</span>
              <span>Create Pattern</span>
            </button>
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

// Test query gadget - filters to max nodes only
const testQuery = withMetadata(fn.query());
const stepsCell = cells.last([
  { type: 'whereKeys', fn: (k: string) => k.startsWith('node/') },
  { type: 'whereValues', fn: (c: any) => c.metadata?.get('ui/type')?.current() === 'max' }
]);

// Wire root table to query source
root.tap(({ changed }) => {
  if (changed) {
    testQuery.receive({ source: changed as Record<string, any> });
  }
});
testQuery.receive({ source: root.current() });

// Wire steps to query
stepsCell.tap(({ changed }) => {
  if (changed) {
    testQuery.receive({ steps: changed as any[] });
  }
});
testQuery.receive({ steps: stepsCell.current() });

// Store query in root with metadata (if metadata exists)
if (testQuery.metadata) {
  testQuery.metadata.set({
    'query/source-key': cells.last('root'),
    'query/steps': stepsCell,
    'query/description': cells.last('Find all max nodes')
  });
}
root.set({ 'query/test-max-nodes': testQuery });

// Log query results when they change
testQuery.whenComputed((results) => {
  console.log('Query results (max nodes):', Object.keys(results));
});

export default function CanvasV2() {
  return (
    <div className="h-screen w-screen flex">
      <Canvas root={root} />
    </div>
  );
}
