/**
 * Canvas route - React Flow canvas with direct tap connections
 *
 * Each node is a tappable gadget, connections are taps between gadgets.
 * No topics, no pubsub, just direct gadget connections.
 */

import { useCallback, useEffect, useState } from 'react';
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

import { useGadget, useTap, type Tappable } from 'port-graphs-react';
import { lastMap, mapCell } from 'port-graphs';

// Node component that is itself a tappable gadget
function NodeGadget({ id, data }: { id: string; data: any }) {
  const [state, updateState, nodeGadget] = useGadget(
    lastMap,
    { id, data, position: { x: 0, y: 0 } }
  );

  // Register this gadget with the parent canvas
  useEffect(() => {
    if (window.__canvasNodeGadgets) {
      window.__canvasNodeGadgets.receive({
        set: [[id, nodeGadget]]
      });
    }
  }, [id, nodeGadget]);

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
  // Store node gadgets in a map cell - reactive map!
  const [nodeGadgets, , nodeGadgetsCell] = useGadget(
    mapCell<string, Tappable>(),
    new Map()
  );

  // Store tap connections in a map cell
  const [connections, , connectionsCell] = useGadget(
    mapCell<string, () => void>(),
    new Map()
  );

  // Make the node gadgets accessible to node components
  useEffect(() => {
    window.__canvasNodeGadgets = nodeGadgetsCell;
    return () => {
      delete window.__canvasNodeGadgets;
    };
  }, [nodeGadgetsCell]);

  // React Flow state
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'node-1',
      type: 'gadget',
      position: { x: 100, y: 100 },
      data: { label: 'Node 1' },
    },
    {
      id: 'node-2',
      type: 'gadget',
      position: { x: 300, y: 100 },
      data: { label: 'Node 2' },
    },
    {
      id: 'node-3',
      type: 'gadget',
      position: { x: 200, y: 250 },
      data: { label: 'Node 3' },
    },
  ]);

  const [edges, setEdges] = useState<Edge[]>([]);

  // Handle node changes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));

      // Handle edge removal - cleanup taps
      changes.forEach((change) => {
        if (change.type === 'remove') {
          const key = change.id;
          const cleanup = connections.get(key);
          if (cleanup) {
            cleanup(); // Clean up the tap
            connectionsCell.receive({
              delete: [key]
            });
          }
        }
      });
    },
    [connections, connectionsCell]
  );

  // Handle new connections - create taps!
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        const sourceGadget = nodeGadgets.get(params.source);
        const targetGadget = nodeGadgets.get(params.target);

        if (sourceGadget && targetGadget) {
          // Create the visual edge
          const newEdge = {
            id: `${params.source}-${params.target}`,
            source: params.source,
            sourceHandle: `${params.source}-source`,
            targetHandle: `${params.target}-target`,
            target: params.target,
          };
          setEdges((eds) => addEdge(newEdge as Edge, eds));

          // Create the computational tap
          const cleanup = sourceGadget.tap((effect: any) => {
            console.log(`Tap: ${params.source} → ${params.target}`, effect);
            // Extract value and send to target
            const value = effect && typeof effect === 'object' && 'changed' in effect
              ? (effect as any).changed
              : effect;
            targetGadget.receive(value);
          });

          // Store the cleanup function
          connectionsCell.receive({
            set: [[newEdge.id, cleanup]]
          });
        }
      }
    },
    [nodeGadgets, connectionsCell]
  );

  // Log active connections
  useTap(connectionsCell, (effect: any) => {
    if (effect && 'changed' in effect) {
      const map = effect.changed as Map<string, any>;
      console.log('Active connections:', Array.from(map.keys()));
    }
  });

  // Add a button to trigger updates (for testing)
  const triggerUpdate = () => {
    const node1 = nodeGadgets.get('node-1');
    if (node1) {
      node1.receive({
        data: {
          label: `Node 1 (${Date.now()})`,
          timestamp: Date.now()
        }
      });
    }
  };

  return (
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

// Type for window extension
declare global {
  interface Window {
    __canvasNodeGadgets?: any;
  }
}