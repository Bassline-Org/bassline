import { useCallback, useEffect, useRef } from 'react';
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
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadget, useTap, CommonGadgetProvider, useCommonGadget, type Tappable } from 'port-graphs-react';
import { lastMap, unionCell, maxCell, lastCell, createGadget } from 'port-graphs';

// Node component that creates a gadget and registers it
function NodeGadget({ id }: { id: string }) {
  const gadgetsTable = useCommonGadget();

  // Create a simple counter gadget for this node
  const [count, , counterGadget] = useGadget(
    () => maxCell(0),
    0
  );

  // Register this node's gadget in the gadgets table
  useEffect(() => {
    gadgetsTable.receive({ [id]: counterGadget });
    return () => {
      // Clean up on unmount
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, counterGadget, gadgetsTable]);

  return (
    <div
      onClick={() => {
        // Increment counter on click
        counterGadget.receive(count + 1);
      }}
      style={{
        padding: '10px',
        border: '2px solid #777',
        borderRadius: '5px',
        background: 'white',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#666' }}>{id}</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{count}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  gadget: NodeGadget,
};

// Spatial computation gadgets
const createProximityGadget = (threshold: number) =>
  createGadget<Set<[string, string]>, Record<string, {x: number, y: number}>>(
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
            Math.pow(pos2.x - pos1.x, 2) +
            Math.pow(pos2.y - pos1.y, 2)
          );
          if (dist < threshold) {
            pairs.add([id1, id2] as [string, string]);
          }
        }
      }

      // Only emit if changed
      if (pairs.size !== current.size ||
          !Array.from(pairs).every(p =>
            Array.from(current).some(c => c[0] === p[0] && c[1] === p[1])
          )) {
        return { action: 'update', context: { pairs } };
      }
      return null;
    },
    {
      'update': (gadget, { pairs }) => {
        gadget.update(pairs);
        return { changed: pairs, proximity: true };
      }
    }
  );

const createCenterOfMassGadget = () =>
  createGadget<{x: number, y: number}, Record<string, {x: number, y: number}>>(
    (current, positions) => {
      const ids = Object.keys(positions);
      if (ids.length === 0) return null;

      let sumX = 0, sumY = 0;
      let count = 0;
      for (const id of ids) {
        const pos = positions[id];
        if (pos) {
          sumX += pos.x;
          sumY += pos.y;
          count++;
        }
      }
      if (count === 0) return null;

      const center = {
        x: sumX / count,
        y: sumY / count
      };

      if (Math.abs(center.x - current.x) > 1 || Math.abs(center.y - current.y) > 1) {
        return { action: 'update', context: { center } };
      }
      return null;
    },
    {
      'update': (gadget, { center }) => {
        gadget.update(center);
        return { changed: center, centerOfMass: true };
      }
    }
  );

export default function CanvasNew() {
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

  const [gadgets, , gadgetsCell] = useGadget(
    lastMap,
    {} as Record<string, Tappable>
  );

  // Spatial computation gadgets
  const [proximityPairs, , proximityGadget] = useGadget(
    () => createProximityGadget(150)(new Set<[string, string]>()),
    new Set<[string, string]>()
  );

  const [centerOfMass, , centerGadget] = useGadget(
    () => createCenterOfMassGadget()({ x: 0, y: 0 }),
    { x: 0, y: 0 }
  );

  // Connect position changes to spatial gadgets
  useTap(positionsCell, (effect) => {
    if (effect && 'changed' in effect) {
      const positions = effect.changed as Record<string, {x: number, y: number}>;
      proximityGadget.receive(positions);
      centerGadget.receive(positions);
    }
  }, []);

  // Use a gadget for the derived nodes state
  const [nodes, , nodesGadget] = useGadget(
    lastCell,
    [] as Node[]
  );

  // Rebuild nodes whenever nodeIds or initial data changes
  useEffect(() => {
    const newNodes = Array.from(nodeIds).map(id => {
      // Preserve existing node if it exists
      const existing = nodes.find((n: Node) => n.id === id);
      if (existing) {
        return existing;
      }
      // Create new node
      return {
        id,
        type: types[id] || 'gadget',
        position: positions[id] || { x: 100, y: 100 },
        data: { id }
      };
    });

    // Only update if actually different
    if (newNodes.length !== nodes.length || !newNodes.every((n, i) => n.id === nodes[i]?.id)) {
      nodesGadget.receive(newNodes);
    }
  }, [nodeIds, types]); // Don't depend on positions to avoid circular updates

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Apply changes to nodes gadget
    const updatedNodes = applyNodeChanges(changes, nodes);
    nodesGadget.receive(updatedNodes);

    // Extract position changes to sync back to position table
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
      // Only sync to position table when not actively dragging
      const isDragging = changes.some(c => c.type === 'position' && c.dragging);
      if (!isDragging) {
        positionsCell.receive(positionUpdates);
      }
    }
  }, [nodes, nodesGadget, positionsCell]);

  // Use a gadget for edges too
  const [edges, , edgesGadget] = useGadget(
    lastCell,
    [] as Edge[]
  );

  // Track active proximity taps for cleanup
  const proximityTapsRef = useRef<Map<string, () => void>>(new Map());

  // Create proximity edges and taps
  useTap(proximityGadget, (effect) => {
    if (effect && 'changed' in effect) {
      const pairs = effect.changed as Set<[string, string]>;
      const currentPairKeys = new Set(Array.from(pairs).map(([a, b]) => `${a}-${b}`));

      // Clean up taps that no longer exist
      for (const [key, cleanup] of proximityTapsRef.current.entries()) {
        if (!currentPairKeys.has(key)) {
          cleanup();
          proximityTapsRef.current.delete(key);
          console.log(`Cleaned up proximity tap: ${key}`);
        }
      }

      // Create new taps for new pairs
      for (const [source, target] of pairs) {
        const key = `${source}-${target}`;
        if (!proximityTapsRef.current.has(key)) {
          const sourceGadget = gadgets[source];
          const targetGadget = gadgets[target];

          if (sourceGadget && targetGadget) {
            // Create bidirectional tap for proximity
            const cleanup1 = sourceGadget.tap((effect: any) => {
              if (effect && 'changed' in effect) {
                targetGadget.receive(effect.changed);
                console.log(`Proximity tap: ${source} → ${target}`, effect.changed);
              }
            });

            const cleanup2 = targetGadget.tap((effect: any) => {
              if (effect && 'changed' in effect) {
                sourceGadget.receive(effect.changed);
                console.log(`Proximity tap: ${target} → ${source}`, effect.changed);
              }
            });

            // Store combined cleanup
            proximityTapsRef.current.set(key, () => {
              cleanup1();
              cleanup2();
            });

            console.log(`Created proximity tap: ${key}`);
          }
        }
      }

      // Create edges for proximity pairs
      const proximityEdges = Array.from(pairs).map(([source, target]) => ({
        id: `proximity-${source}-${target}`,
        source,
        target,
        type: 'straight',
        animated: true,
        style: { stroke: 'rgba(100, 200, 100, 0.3)', strokeWidth: 2 },
        data: { proximity: true }
      }));

      // Keep existing non-proximity edges and add proximity edges
      const nonProximityEdges = edges.filter((e: Edge) => !(e.data as any)?.proximity);
      edgesGadget.receive([...nonProximityEdges, ...proximityEdges]);
    }
  }, [edges, gadgets]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updatedEdges = applyEdgeChanges(changes, edges);
    edgesGadget.receive(updatedEdges);
  }, [edges, edgesGadget]);

  // Handle connections - create taps between gadgets
  const onConnect = useCallback((params: Connection) => {
    if (params.source && params.target) {
      const sourceGadget = gadgets[params.source];
      const targetGadget = gadgets[params.target];

      if (sourceGadget && targetGadget) {
        // Create the visual edge
        const newEdge: Edge = {
          id: `${params.source}-${params.target}`,
          source: params.source!,
          target: params.target!,
        };
        edgesGadget.receive([...edges, newEdge]);

        // Create the computational tap
        sourceGadget.tap((effect: any) => {
          console.log(`Tap: ${params.source} → ${params.target}`, effect);
          // Send the changed value to target
          if (effect && typeof effect === 'object' && 'changed' in effect) {
            targetGadget.receive(effect.changed);
          }
        });
      }
    }
  }, [gadgets]);

  // Add test nodes
  const addTestNode = useCallback(() => {
    const id = `node-${Math.random().toString(36).substring(2, 11)}`;

    // Add to node set
    nodeIdsCell.receive(new Set([id]));

    // Set position
    positionsCell.receive({
      [id]: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 200 }
    });

    // Set type
    typesCell.receive({
      [id]: 'gadget'
    });
  }, [nodeIdsCell, positionsCell, typesCell]);

  // Initialize with some test nodes
  useEffect(() => {
    // Add initial nodes
    nodeIdsCell.receive(new Set(['node-1', 'node-2']));
    positionsCell.receive({
      'node-1': { x: 100, y: 100 },
      'node-2': { x: 300, y: 100 }
    });
    typesCell.receive({
      'node-1': 'gadget',
      'node-2': 'gadget'
    });
  }, []);

  return (
    <CommonGadgetProvider value={gadgetsCell}>
      <div style={{ width: '100vw', height: '100vh' }}>
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Spatial Computing Canvas</h3>
          <button onClick={addTestNode}>
            Add Node
          </button>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            • Click nodes to increment counter<br />
            • Drag close for auto-sync (bidirectional)<br />
            • Proximity pairs (&lt; 150px): {proximityPairs.size}<br />
            • Center of mass: ({Math.round(centerOfMass.x)}, {Math.round(centerOfMass.y)})
          </div>
        </div>

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
    </CommonGadgetProvider>
  );
}