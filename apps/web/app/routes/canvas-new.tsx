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

// Counter gadget - clicks increment
function CounterGadget({ id }: { id: string }) {
  const gadgetsTable = useCommonGadget();
  const [count, , counterGadget] = useGadget(
    () => maxCell(0),
    0
  );

  useEffect(() => {
    gadgetsTable.receive({ [id]: counterGadget });
    return () => {
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, counterGadget, gadgetsTable]);

  return (
    <div
      onClick={() => { counterGadget.receive(count + 1); console.log('id: ', id) }}
      style={{
        padding: '10px',
        border: '2px solid #4a90e2',
        borderRadius: '5px',
        background: '#e3f2fd',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Counter</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{count}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div >
  );
}

// Timer gadget - emits incremental values
function TimerGadget({ id }: { id: string }) {
  const gadgetsTable = useCommonGadget();
  const [value, , timerGadget] = useGadget(
    lastCell,
    0
  );

  useEffect(() => {
    gadgetsTable.receive({ [id]: timerGadget });
    const interval = setInterval(() => {
      timerGadget.receive((value as number) + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, timerGadget, gadgetsTable, value]);

  return (
    <div
      style={{
        padding: '10px',
        border: '2px solid #4caf50',
        borderRadius: '5px',
        background: '#e8f5e9',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Timer</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>⏰ {value}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

// Display gadget - shows last received value
function DisplayGadget({ id }: { id: string }) {
  const gadgetsTable = useCommonGadget();
  const [display, , displayGadget] = useGadget(
    lastCell,
    0
  );

  useTap(displayGadget, (effect) => {
    console.log('displayGadget', effect);
  }, []);

  useEffect(() => {
    gadgetsTable.receive({ [id]: displayGadget });
    return () => {
      gadgetsTable.receive({ [id]: undefined });
    };
  }, [id, displayGadget, gadgetsTable]);

  return (
    <div
      style={{
        padding: '10px',
        border: '2px solid #9c27b0',
        borderRadius: '5px',
        background: '#f3e5f5',
        userSelect: 'none',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>Display</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>📺 {display}</div>
      </div>
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

// Main node component that switches based on type
function NodeGadget({ id, data }: { id: string; data: any }) {
  // Get the type from the data (ReactFlow passes it through)
  const nodeType = data?.type || 'counter';

  switch (nodeType) {
    case 'timer':
      return <TimerGadget id={id} />;
    case 'display':
      return <DisplayGadget id={id} />;
    case 'counter':
    default:
      return <CounterGadget id={id} />;
  }
}

const nodeTypes = {
  gadget: NodeGadget,
  //region: RegionNode,
};

// Spatial computation gadgets
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

// Region gadget - detects which nodes are inside and applies transformations
const createRegionGadget = (bounds: { x: number, y: number, width: number, height: number }, transform?: (value: any) => any) =>
  createGadget<Set<string>, { positions: Record<string, { x: number, y: number }>, gadgets: Record<string, any> }>(
    (current, { positions, gadgets }) => {
      const inside = new Set<string>();

      for (const [id, pos] of Object.entries(positions)) {
        if (pos.x >= bounds.x &&
          pos.x <= bounds.x + bounds.width &&
          pos.y >= bounds.y &&
          pos.y <= bounds.y + bounds.height) {
          inside.add(id);
        }
      }

      // Check if the set of nodes inside has changed
      const changed = inside.size !== current.size ||
        !Array.from(inside).every(id => current.has(id));

      if (changed) {
        return { action: 'update', context: { inside, gadgets } };
      }
      return null;
    },
    {
      'update': (gadget, { inside, gadgets }) => {
        const prevInside = gadget.current();
        gadget.update(inside);

        // Apply transformation to nodes entering the region
        if (transform) {
          for (const id of inside) {
            if (!prevInside.has(id) && gadgets[id]) {
              // Node just entered - could apply transformation
              console.log(`Node ${String(id)} entered region`);
            }
          }
        }

        return {
          changed: inside,
          entered: Array.from(inside).filter(id => !prevInside.has(id as string)),
          exited: Array.from(prevInside).filter(id => !inside.has(id))
        };
      }
    }
  );

// // Custom node to represent regions in ReactFlow's coordinate system
// function RegionNode({ data }: { data: any }) {
//   return (
//     <div
//       style={{
//         width: data.width || 200,
//         height: data.height || 150,
//         border: `2px dashed ${data.color}`,
//         borderRadius: '8px',
//         background: `${data.color}20`,
//         display: 'flex',
//         flexDirection: 'column',
//         alignItems: 'center',
//         justifyContent: 'center',
//       }}
//     >
//       <div style={{
//         background: 'white',
//         padding: '4px 8px',
//         borderRadius: '4px',
//         fontSize: '12px',
//         fontWeight: 'bold',
//         color: data.color
//       }}>
//         {data.label}
//       </div>
//       {data.nodesInside > 0 && (
//         <div style={{
//           fontSize: '10px',
//           marginTop: '4px',
//           background: 'white',
//           padding: '2px 6px',
//           borderRadius: '4px'
//         }}>
//           {data.nodesInside} nodes
//         </div>
//       )}
//     </div>
//   );
// }

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

  // // Create spatial regions
  // const [multiplyRegion, , multiplyRegionGadget] = useGadget(
  //   () => createRegionGadget(
  //     { x: 250, y: 50, width: 200, height: 150 },
  //     (value) => value * 2
  //   )(new Set()),
  //   new Set<string>()
  // );

  // const [slowRegion, , slowRegionGadget] = useGadget(
  //   () => createRegionGadget(
  //     { x: 50, y: 250, width: 200, height: 150 },
  //     (value) => value / 2
  //   )(new Set()),
  //   new Set<string>()
  // );

  // Track which gadgets are in which regions for transformations
  const regionTransformsRef = useRef<Map<string, (value: any) => any>>(new Map());

  // // Update transforms based on regions
  // useTap(multiplyRegionGadget, (effect) => {
  //   if (effect && 'changed' in effect) {
  //     const inside = effect.changed as Set<string>;
  //     // Apply 2x multiplier to gadgets in this region
  //     for (const id of inside) {
  //       regionTransformsRef.current.set(id, (v) => typeof v === 'number' ? v * 2 : v);
  //     }
  //     // Remove transform for gadgets that left
  //     for (const [id, _] of regionTransformsRef.current) {
  //       if (!inside.has(id) && id.includes('multiply')) {
  //         regionTransformsRef.current.delete(id);
  //       }
  //     }
  //   }
  // }, []);

  // useTap(slowRegionGadget, (effect) => {
  //   if (effect && 'entered' in effect) {
  //     const entered = effect.entered as string[];
  //     console.log('Nodes entered slow region:', entered);
  //   }
  // }, []);

  // Connect position changes to spatial gadgets
  useTap(positionsCell, (effect) => {
    if (effect && 'changed' in effect) {
      const positions = effect.changed as Record<string, { x: number, y: number }>;
      proximityGadget.receive(positions);
      // multiplyRegionGadget.receive({ positions, gadgets });
      // slowRegionGadget.receive({ positions, gadgets });
    }
  }, [gadgets]);

  // Use a gadget for the derived nodes state
  const [nodes, , nodesGadget] = useGadget(
    lastCell,
    [] as Node[]
  );

  // Rebuild nodes whenever nodeIds or initial data changes
  useEffect(() => {
    //   // Add region nodes first (so they appear behind gadgets)
    //   const regionNodes = [
    //     {
    //       id: 'multiply-region',
    //       type: 'region' as const,
    //       position: { x: 250, y: 50 },
    //       selectable: false,
    //       draggable: false,
    //       data: {
    //         width: 200,
    //         height: 150,
    //         label: 'Multiply Region (2x)',
    //         color: '#4caf50',
    //         nodesInside: 0
    //       }
    //     },
    //     {
    //       id: 'slow-region',
    //       type: 'region' as const,
    //       position: { x: 50, y: 250 },
    //       selectable: false,
    //       draggable: false,
    //       data: {
    //         width: 200,
    //         height: 150,
    //         label: 'Slow Region (÷2)',
    //         color: '#f44336',
    //         nodesInside: 0
    //       }
    //     }
    //   ];

    const gadgetNodes = Array.from(nodeIds).map(id => {
      // Preserve existing node if it exists
      const existing = nodes.find((n: Node) => n.id === id);
      if (existing && existing.type !== 'region') {
        return existing;
      }
      // Create new node
      return {
        id,
        type: 'gadget' as const, // ReactFlow node type (always gadget)
        position: positions[id] || { x: 100, y: 100 },
        data: { id, type: types[id] || 'counter' } // Pass our gadget type in data
      };
    });

    const allNodes = [...gadgetNodes];

    // Only update if actually different
    if (allNodes.length !== nodes.length || !allNodes.every((n, i) => n.id === nodes[i]?.id)) {
      nodesGadget.receive(allNodes);
    }
  }, [nodeIds, types]); // Include region sizes to update counts

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
            // Sync current values immediately
            const sourceValue = sourceGadget.current();
            const targetValue = targetGadget.current();

            // Send current values to establish initial sync
            const targetType = types[target];
            const sourceType = types[source];

            if (targetType === 'adder' && sourceValue !== undefined && sourceValue !== null) {
              targetGadget.receive({ from: source as string, value: sourceValue });
            } else if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '-') {
              targetGadget.receive(sourceValue);
            }

            if (sourceType === 'adder' && targetValue !== undefined && targetValue !== null) {
              sourceGadget.receive({ from: target as string, value: targetValue });
            } else if (targetValue !== undefined && targetValue !== null && targetValue !== '-') {
              sourceGadget.receive(targetValue);
            }

            // Create bidirectional tap for ongoing changes
            const cleanup1 = sourceGadget.tap((effect: any) => {
              if (effect && 'changed' in effect) {
                let value = effect.changed;

                // Apply region transformation if source is in a region
                const transform = regionTransformsRef.current.get(source);
                if (transform) {
                  value = transform(value);
                  console.log(`Applied transform to ${source}: ${effect.changed} → ${value}`);
                }

                // Send with source info if target is an adder
                if (targetType === 'adder') {
                  targetGadget.receive({ from: source as string, value });
                } else {
                  targetGadget.receive(value);
                }
                console.log(`Proximity tap: ${source} → ${target}`, value);
              }
            });

            const cleanup2 = targetGadget.tap((effect: any) => {
              if (effect && 'changed' in effect) {
                let value = effect.changed;

                // Apply region transformation if target is in a region
                const transform = regionTransformsRef.current.get(target);
                if (transform) {
                  value = transform(value);
                  console.log(`Applied transform to ${target}: ${effect.changed} → ${value}`);
                }

                // Send with source info if source is an adder
                if (sourceType === 'adder') {
                  sourceGadget.receive({ from: target as string, value });
                } else {
                  sourceGadget.receive(value);
                }
                console.log(`Proximity tap: ${target} → ${source}`, value);
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
  }, [edges, gadgets, types]);

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
  // Add nodes of different types
  const addNode = useCallback((type: string) => {
    const id = `${type}-${Math.random().toString(36).substring(2, 6)}`;

    // Add to node set
    nodeIdsCell.receive(new Set([id]));

    // Set position
    positionsCell.receive({
      [id]: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 200 }
    });

    // Set type
    typesCell.receive({
      [id]: type
    });
  }, [nodeIdsCell, positionsCell, typesCell]);

  // Initialize with demo setup showing composition
  useEffect(() => {
    // Create a demo setup: two counters feeding an adder, displayed
    nodeIdsCell.receive(new Set(['counter-1', 'counter-2', 'adder-1', 'display-1']));
    positionsCell.receive({
      'counter-1': { x: 100, y: 100 },
      'counter-2': { x: 100, y: 200 },
      'adder-1': { x: 300, y: 150 },
      'display-1': { x: 500, y: 150 }
    });
    typesCell.receive({
      'counter-1': 'counter',
      'counter-2': 'counter',
      'adder-1': 'adder',
      'display-1': 'display'
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
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <button onClick={() => addNode('counter')}
              style={{ padding: '5px 10px', background: '#e3f2fd', border: '1px solid #4a90e2', borderRadius: '3px', cursor: 'pointer' }}>
              + Counter
            </button>
            <button onClick={() => addNode('timer')}
              style={{ padding: '5px 10px', background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '3px', cursor: 'pointer' }}>
              + Timer
            </button>
            <button onClick={() => addNode('adder')}
              style={{ padding: '5px 10px', background: '#fff3e0', border: '1px solid #ff9800', borderRadius: '3px', cursor: 'pointer' }}>
              + Adder
            </button>
            <button onClick={() => addNode('display')}
              style={{ padding: '5px 10px', background: '#f3e5f5', border: '1px solid #9c27b0', borderRadius: '3px', cursor: 'pointer' }}>
              + Display
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            • Click nodes to increment counter<br />
            • Drag close for auto-sync (bidirectional)<br />
            • Proximity pairs (&lt; 150px): {proximityPairs.size}<br />
            {/* • Multiply region (2x): {multiplyRegion.size} nodes<br /> */}
            {/* • Slow region (÷2): {slowRegion.size} nodes */}
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