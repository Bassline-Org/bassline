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
import { lastMap, mapCell, lastCell, firstMap, unionCell } from 'port-graphs';

// Node component that is itself a tappable gadget
function NodeGadget({ id, data }: { id: string; data: any }) {
  const registry = useCommonGadget();
  const [state, updateState, nodeGadget] = useGadget(
    lastMap,
    { id, data, position: { x: 0, y: 0 } }
  );

  // Register ourselves in the shared registry
  useEffect(() => {
    registry.receive({ set: [[id, nodeGadget]] });
  }, [id, nodeGadget, registry]);

  return (
    <div
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
        // Update position on right click (demo)
        updateState({
          position: {
            x: state['position'].x + 10,
            y: state['position'].y + 10
          }
        });
      }}
      style={{
        padding: '10px',
        border: '2px solid #777',
        borderRadius: '5px',
        background: 'white',
      }}
    >
      <Handle id={`${id}-target`} type="target" position={Position.Left} />
      {data.label || id}
      <Handle id={`${id}-source`} type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  gadget: NodeGadget,
};

export default function CanvasNew() {
  // Create a registry gadget that will be shared via context
  const [gadgets, , registry] = useGadget(
    mapCell,
    {} as Record<string, Tappable>
  );

  // React Flow state using gadgets!
  const [nodes, , nodesCell] = useGadget(lastCell, [] as Node[]);
  const setNodes = useCallback((changes: NodeChange[]) => {
    nodesCell.receive(applyNodeChanges(changes, nodes));
  }, [nodesCell]);

  const [edges, , edgesCell] = useGadget(lastCell, [] as Edge[]);
  const setEdges = useCallback((changes: EdgeChange[]) => {
    edgesCell.receive(applyEdgeChanges(changes, edges));
  }, [edgesCell]);

  // // Handle new connections - create taps!
  // const onConnect = useCallback(
  //   (params: Connection) => {
  //     if (params.source && params.target) {
  //       const sourceGadget = gadgets.get(params.source);
  //       const targetGadget = nodeGadgetsRef.current.get(params.target);

  //       if (sourceGadget && targetGadget) {
  //         // Create the visual edge
  //         const newEdge = {
  //           id: `${params.source}-${params.target}`,
  //           source: params.source,
  //           sourceHandle: `${params.source}-source`,
  //           targetHandle: `${params.target}-target`,
  //           target: params.target,
  //         };
  //         setEdges(addEdge(newEdge as Edge, edges));

  //         // Create the computational tap
  //         const cleanup = sourceGadget.tap((effect: any) => {
  //           console.log(`Tap: ${params.source} → ${params.target}`, effect);
  //           // Extract value and send to target
  //           const value = effect && typeof effect === 'object' && 'changed' in effect
  //             ? (effect as any).changed
  //             : effect;
  //           targetGadget.receive(value);
  //         });

  //         // Store the cleanup function
  //         connectionsCell.receive({
  //           set: [[newEdge.id, cleanup]]
  //         });
  //       }
  //     }
  //   },
  //   [connectionsCell]
  // );

  // Log active connections
  // useTap(connectionsCell, (effect: any) => {
  //   if (effect && 'changed' in effect) {
  //     const map = effect.changed as Map<string, any>;
  //     console.log('Active connections:', Array.from(map.keys()));
  //   }
  // });

  // Add a button to trigger updates (for testing)
  const triggerUpdate = useCallback(() => {
    console.log('triggerUpdate', gadgets);
    const node1 = gadgets.get('node-1');
    if (node1) {
      node1.receive({
        data: {
          label: `Node 1 (${Date.now()})`,
          timestamp: Date.now()
        }
      });
    }
  }, [gadgets]);

  return (
    <CommonGadgetProvider value={registry}>
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
          <h3 style={{ margin: '0 0 10px 0' }}>Direct Tap Canvas</h3>
          <button onClick={triggerUpdate}>
            Update Node 1
          </button>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            • Drag to connect nodes (creates taps)<br />
            • Right-click nodes to update position<br />
            • Connections are direct gadget taps
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => setNodes(changes)}
          onEdgesChange={(changes) => setEdges(changes)}
          //onConnect={onConnect}
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