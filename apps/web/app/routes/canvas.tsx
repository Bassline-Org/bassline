/**
 * Canvas route demonstrating React Flow with gadget-based state management
 *
 * The canvas subscribes to 'reactflow:nodes' and 'reactflow:edges' topics.
 * Transformers publish to these topics, converting gadget state to React Flow format.
 * This makes the canvas completely extensible - any gadget can publish to these topics.
 */

import { useCallback, useEffect } from 'react';
import { ReactFlow, Controls, MiniMap, Background, BackgroundVariant, type Node, type NodeChange, type EdgeChange, type Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadgetWithRef, usePubSubContext, PubSubProvider, useGadget, useSub } from 'port-graphs-react';
import { lastCell, lastMap, maxCell, createNodeTransformer, createEdgeTransformer } from 'port-graphs';

// Initial positions for demo gadgets
const initialPositions = {
  'counter-1': { x: 250, y: 100 },
  'counter-2': { x: 100, y: 200 },
  'counter-3': { x: 400, y: 200 },
};

// Initial node types
const initialNodeTypes = {
  'counter-1': 'default',
  'counter-2': 'default',
  'counter-3': 'default',
};

// Initial node data
const initialNodeData = {
  'counter-1': { label: 'Counter 1', value: 0 },
  'counter-2': { label: 'Counter 2', value: 0 },
  'counter-3': { label: 'Counter 3', value: 0 },
};

function CanvasContent() {
  const { registry, subscriptions } = usePubSubContext();

  // Create subscriber gadgets for nodes and edges
  const [nodes, , nodesGadget] = useGadgetWithRef(
    () => lastCell([]),
    []
  );

  const [edges, , edgesGadget] = useGadgetWithRef(
    () => lastCell([]),
    []
  );

  // Subscribe to the reactflow topics
  useSub(nodesGadget, 'reactflow:nodes');
  useSub(edgesGadget, 'reactflow:edges');

  // Create gadgets for positions, node types, and node data
  const [positions, sendPositions, positionsGadget] = useGadgetWithRef(
    () => lastMap(initialPositions),
    initialPositions
  );

  const [nodeTypes, , nodeTypesGadget] = useGadgetWithRef(
    () => lastMap(initialNodeTypes),
    initialNodeTypes
  );

  const [nodeData, sendNodeData, nodeDataGadget] = useGadgetWithRef(
    () => lastMap(initialNodeData),
    initialNodeData
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>

      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        background: 'white',
        padding: 20,
        borderRadius: 8,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3>Gadget System State</h3>
        <p>Click nodes to increment counters</p>
        <p>Connect nodes to create subscriptions</p>
        <ul>
          {nodes.map((node: any) => (
            <li key={node.id}>
              {node.data.label}: {node.data.value || 0}
            </li>
          ))}
        </ul>
        <h4>Active Subscriptions:</h4>
        <ul>
          {Object.entries(subscriptions.current() as Record<string, string[]>).map(([topic, subs]) => (
            <li key={topic}>
              {topic} → [{subs.join(', ')}]
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Canvas() {
  return (
    <PubSubProvider>
      <CanvasContent />
    </PubSubProvider>
  );
}