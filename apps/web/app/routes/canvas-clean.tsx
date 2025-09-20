import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadget, useTap, CommonGadgetProvider, useCommonGadget } from 'port-graphs-react';
import { lastMap, unionCell, lastCell, createGadget } from 'port-graphs';
import { GadgetNode } from '../gadget-components';

// Node types for ReactFlow
const nodeTypes = {
  gadget: GadgetNode,
};

// Gadget type definitions for the palette
const gadgetCategories = {
  data: {
    label: 'Data',
    icon: '📊',
    gadgets: [
      { type: 'counter', name: 'Counter', icon: '🔢', description: 'Click to increment' },
      { type: 'timer', name: 'Timer', icon: '⏰', description: 'Auto-incrementing timer' },
      { type: 'constant', name: 'Constant', icon: '📌', description: 'Constant value' },
    ]
  },
  math: {
    label: 'Math',
    icon: '🔢',
    gadgets: [
      { type: 'adder', name: 'Adder', icon: '➕', description: 'Sums all inputs' },
      { type: 'multiplier', name: 'Multiplier', icon: '✖️', description: 'Multiplies all inputs' },
    ]
  },
  visual: {
    label: 'Visual',
    icon: '👁️',
    gadgets: [
      { type: 'display', name: 'Display', icon: '📺', description: 'Shows incoming values' },
    ]
  }
};

// Connection Settings UI
function ConnectionSettings({ mode, onModeChange }: { mode: string; onModeChange: (mode: string) => void }) {
  const [showSettings, , showGadget] = useGadget(lastCell, false);
  const [threshold, , thresholdGadget] = useGadget(lastCell, 150);

  if (!showSettings) {
    return (
      <div
        style={{
          position: 'absolute',
          right: 10,
          top: 10,
          padding: '10px',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: 'pointer',
          zIndex: 10,
        }}
        onClick={() => showGadget.receive(true)}
      >
        ⚙️ Connections
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 10,
        top: 10,
        width: 250,
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '10px',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Connection Mode</h3>
        <button
          onClick={() => showGadget.receive(false)}
          style={{ border: 'none', background: 'none', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label>
          <input
            type="radio"
            checked={mode === 'proximity'}
            onChange={() => onModeChange('proximity')}
          /> Proximity
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'manual'}
            onChange={() => onModeChange('manual')}
          /> Manual
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'none'}
            onChange={() => onModeChange('none')}
          /> None
        </label>
      </div>
    </div>
  );
}

// Palette component
function GadgetPalette({ onAddGadget }: { onAddGadget: (type: string) => void }) {
  const [expandedCategory, , expandedGadget] = useGadget(lastCell, 'data' as string | null);

  return (
    <div style={{
      position: 'absolute',
      left: 10,
      top: 10,
      width: 200,
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '10px',
      zIndex: 10,
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Gadget Library</h3>

      {Object.entries(gadgetCategories).map(([catKey, category]) => (
        <div key={catKey} style={{ marginBottom: '10px' }}>
          <div
            onClick={() => expandedGadget.receive(expandedCategory === catKey ? null : catKey)}
            style={{
              padding: '5px',
              background: '#f5f5f5',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>{category.icon} {category.label}</span>
            <span>{expandedCategory === catKey ? '▼' : '▶'}</span>
          </div>

          {expandedCategory === catKey && (
            <div style={{ marginTop: '5px', paddingLeft: '10px' }}>
              {category.gadgets.map((gadget) => (
                <div
                  key={gadget.type}
                  onClick={() => onAddGadget(gadget.type)}
                  style={{
                    padding: '5px',
                    margin: '2px 0',
                    background: '#fff',
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <div>{gadget.icon} {gadget.name}</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>{gadget.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Spatial proximity gadget
const createProximityGadget = (threshold: number) =>
  createGadget<Set<[string, string]>, Record<string, { x: number, y: number }>>(
    (current, positions) => {
      const pairs = new Set<[string, string]>();
      const ids = Object.keys(positions);

      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const id1 = ids[i];
          const id2 = ids[j];
          if (!id1 || !id2) continue;

          const pos1 = positions[id1];
          const pos2 = positions[id2];
          if (!pos1 || !pos2) continue;

          const dist = Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) +
            Math.pow(pos1.y - pos2.y, 2)
          );

          if (dist < threshold) {
            pairs.add([id1, id2]);
          }
        }
      }

      const pairsArray = Array.from(pairs);
      const currentArray = Array.from(current);
      const changed = pairsArray.length !== currentArray.length ||
        !pairsArray.every(([a, b]) =>
          currentArray.some(([ca, cb]) => (ca === a && cb === b) || (ca === b && cb === a))
        );

      if (changed) {
        return { action: 'update', context: { pairs } };
      }
      return null;
    },
    {
      'update': (gadget, { pairs }) => {
        gadget.update(pairs);
        return { changed: pairs };
      }
    }
  );

function CanvasContent() {
  // ECS-style tables for node data
  const [nodeIds, , nodeIdsCell] = useGadget(
    unionCell,
    new Set<string>()
  );

  const [positions, , positionsCell] = useGadget(
    lastMap,
    {} as Record<string, { x: number, y: number }>
  );

  const [types, , typesCell] = useGadget(
    lastMap,
    {} as Record<string, string>
  );

  const gadgetsTable = useCommonGadget();

  // Connection mode
  const [connectionMode, , connectionModeGadget] = useGadget(lastCell, 'proximity');

  // Spatial proximity gadget
  const [, , proximityGadget] = useGadget(
    () => createProximityGadget(150)(new Set<[string, string]>()),
    new Set<[string, string]>()
  );

  // Connect position changes to proximity gadget (only if in proximity mode)
  useTap(positionsCell, (effect) => {
    if (connectionMode === 'proximity' && effect && 'changed' in effect) {
      const positions = effect.changed as Record<string, { x: number, y: number }>;
      proximityGadget.receive(positions);
    }
  }, [connectionMode]);

  // Use a gadget for the derived nodes state
  const [nodes, , nodesGadget] = useGadget(
    lastCell,
    [] as Node[]
  );

  // Rebuild nodes whenever nodeIds or types change
  useEffect(() => {
    const gadgetNodes = Array.from(nodeIds).map(id => {
      const existing = nodes.find((n: Node) => n.id === id);
      if (existing) {
        return existing;
      }
      return {
        id,
        type: 'gadget' as const,
        position: positions[id] || { x: 100, y: 100 },
        data: { id, type: types[id] || 'counter' }
      };
    });

    if (gadgetNodes.length !== nodes.length || !gadgetNodes.every((n, i) => n.id === nodes[i]?.id)) {
      nodesGadget.receive(gadgetNodes);
    }
  }, [nodeIds, types]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes);
    nodesGadget.receive(updatedNodes);

    // Extract position changes
    const positionChanges = changes.filter(
      (change) => change.type === 'position' && change.position
    );

    if (positionChanges.length > 0) {
      const positionUpdates: Record<string, { x: number, y: number }> = {};
      for (const change of positionChanges) {
        if (change.type === 'position' && change.position) {
          positionUpdates[change.id] = change.position;
        }
      }
      const isDragging = changes.some(c => c.type === 'position' && c.dragging);
      if (!isDragging) {
        positionsCell.receive(positionUpdates);
      }
    }
  }, [nodes, nodesGadget, positionsCell]);

  // Use a gadget for edges
  const [edges, , edgesGadget] = useGadget(
    lastCell,
    [] as Edge[]
  );

  // Create connections based on mode
  useTap(proximityGadget, (effect) => {
    if (connectionMode === 'proximity' && effect && 'changed' in effect) {
      const pairs = effect.changed as Set<[string, string]>;

      // Setup connections between proximate gadgets
      pairs.forEach(([source, target]) => {
        const sourceGadget = (gadgetsTable.current() as any)[source];
        const targetGadget = (gadgetsTable.current() as any)[target];

        if (sourceGadget && targetGadget) {
          // Initial sync
          const sourceValue = sourceGadget.current();
          const targetType = types[target];

          // Send initial values
          if (targetType === 'adder' || targetType === 'multiplier') {
            if (sourceValue !== undefined && sourceValue !== null) {
              targetGadget.receive({ from: source, value: sourceValue });
            }
          } else if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '-') {
            targetGadget.receive(sourceValue);
          }

          // Setup ongoing taps
          sourceGadget.tap((effect: any) => {
            if (effect && 'changed' in effect) {
              const value = effect.changed;
              if (targetType === 'adder' || targetType === 'multiplier') {
                targetGadget.receive({ from: source, value });
              } else {
                targetGadget.receive(value);
              }
            }
          });
        }
      });

      // Create visual edges
      const proximityEdges = Array.from(pairs).map(([source, target]) => ({
        id: `proximity-${source}-${target}`,
        source,
        target,
        type: 'straight',
        animated: true,
        style: { stroke: 'rgba(100, 200, 100, 0.3)', strokeWidth: 2 },
      }));

      edgesGadget.receive(proximityEdges);
    }
  }, [types, gadgetsTable, connectionMode]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updatedEdges = applyEdgeChanges(changes, edges);
    edgesGadget.receive(updatedEdges);
  }, [edges, edgesGadget]);

  const onConnect = useCallback((params: Connection) => {
    if (connectionMode === 'manual') {
      const newEdge = addEdge(params, edges);
      edgesGadget.receive(newEdge);
    }
  }, [edges, edgesGadget, connectionMode]);

  // Add gadget handler
  const addGadget = useCallback((type: string) => {
    const id = `gadget-${Date.now()}`;

    // Update ECS tables
    nodeIdsCell.receive(new Set([...nodeIds, id]));
    typesCell.receive({ ...types, [id]: type });
    positionsCell.receive({
      ...positions,
      [id]: {
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200
      }
    });
  }, [nodeIds, types, positions]);

  // Initialize with some gadgets
  useEffect(() => {
    if (nodeIds.size === 0) {
      addGadget('counter');
      addGadget('timer');
      addGadget('display');
    }
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <GadgetPalette onAddGadget={addGadget} />
      <ConnectionSettings mode={connectionMode} onModeChange={(mode) => connectionModeGadget.receive(mode)} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

export default function CanvasClean() {
  // Create the common gadgets table
  const [, , gadgetsTable] = useGadget(
    lastMap,
    {} as Record<string, any>
  );

  return (
    <CommonGadgetProvider value={gadgetsTable}>
      <CanvasContent />
    </CommonGadgetProvider>
  );
}