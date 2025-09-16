/**
 * Canvas route demonstrating React Flow with gadget-based state management
 *
 * The canvas subscribes to 'reactflow:nodes' and 'reactflow:edges' topics.
 * Transformers publish to these topics, converting gadget state to React Flow format.
 * This makes the canvas completely extensible - any gadget can publish to these topics.
 */

import React, { useCallback } from 'react';
import { ReactFlow, Controls, MiniMap, Background, BackgroundVariant, applyNodeChanges, applyEdgeChanges, type Node, type NodeChange, type EdgeChange, type Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadgetWithRef, usePubSubContext, PubSubProvider, useSub } from 'port-graphs-react';
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
  const { registry, subscriptions, pubsub } = usePubSubContext();

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
  const [, sendPositions, positionsGadget] = useGadgetWithRef(
    () => lastMap(initialPositions),
    initialPositions
  );

  const [, , nodeTypesGadget] = useGadgetWithRef(
    () => lastMap(initialNodeTypes),
    initialNodeTypes
  );

  const [nodeData, sendNodeData, nodeDataGadget] = useGadgetWithRef(
    () => lastMap(initialNodeData),
    initialNodeData
  );

  // Create and register transformers (only happens once due to React's reconciliation)
  const nodeTransformer = createNodeTransformer()({
    registry: {},
    positions: {},
    nodeTypes: {},
    nodeData: {}
  });

  const edgeTransformer = createEdgeTransformer()({
    subscriptions: {}
  });

  // Register transformers if not already registered
  if (!registry.current()['node-transformer']) {
    registry.receive({ 'node-transformer': nodeTransformer });

    // Wire node transformer to receive updates and publish
    const origNodeEmit = nodeTransformer.emit;
    nodeTransformer.emit = (effect) => {
      origNodeEmit(effect);
      // Function gadgets emit changed({ result, args })
      if (effect && typeof effect === 'object' && 'changed' in effect && 'result' in effect.changed) {
        // Publish nodes through pubsub
        pubsub.receive({
          command: {
            type: 'publish',
            topic: 'reactflow:nodes',
            data: effect.changed.result
          }
        });
      }
    };

    // Wire inputs to node transformer
    const origRegistryEmit = registry.emit;
    registry.emit = (effect: any) => {
      origRegistryEmit(effect);
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        nodeTransformer.receive({ registry: effect.changed });
      }
    };

    const origPosEmit = positionsGadget.emit;
    positionsGadget.emit = (effect: any) => {
      origPosEmit(effect);
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        nodeTransformer.receive({ positions: effect.changed });
      }
    };

    const origTypesEmit = nodeTypesGadget.emit;
    nodeTypesGadget.emit = (effect: any) => {
      origTypesEmit(effect);
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        nodeTransformer.receive({ nodeTypes: effect.changed });
      }
    };

    const origDataEmit = nodeDataGadget.emit;
    nodeDataGadget.emit = (effect: any) => {
      origDataEmit(effect);
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        nodeTransformer.receive({ nodeData: effect.changed });
      }
    };
  }

  if (!registry.current()['edge-transformer']) {
    registry.receive({ 'edge-transformer': edgeTransformer });

    // Wire edge transformer to receive updates and publish
    const origEdgeEmit = edgeTransformer.emit;
    edgeTransformer.emit = (effect) => {
      origEdgeEmit(effect);
      // Function gadgets emit changed({ result, args })
      if (effect && typeof effect === 'object' && 'changed' in effect && 'result' in effect.changed) {
        // Publish edges through pubsub
        // Function gadgets need the argument wrapped with its key
        pubsub.receive({
          command: {
            type: 'publish',
            topic: 'reactflow:edges',
            data: effect.changed.result
          }
        });
      }
    };

    // Wire inputs to edge transformer
    const origSubsEmit = subscriptions.emit;
    subscriptions.emit = (effect: any) => {
      origSubsEmit(effect);
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        edgeTransformer.receive({ subscriptions: effect.changed });
      }
    };
  }

  // Create demo counter gadgets if not already created
  if (!registry.current()['counter-1']) {
    const counter1 = maxCell(0);
    const counter2 = maxCell(0);
    const counter3 = maxCell(0);

    registry.receive({ 'counter-1': counter1 });
    registry.receive({ 'counter-2': counter2 });
    registry.receive({ 'counter-3': counter3 });

    // Set up some subscriptions for demo
    subscriptions.receive({
      type: 'subscribe',
      topic: 'counter-1:increment',
      subscriber: 'counter-2'
    });
    subscriptions.receive({
      type: 'subscribe',
      topic: 'counter-1:increment',
      subscriber: 'counter-3'
    });
  }

  // Register the subscriber gadgets in the registry so they can receive messages
  if (!registry.current()['nodes-gadget']) {
    registry.receive({ 'nodes-gadget': nodesGadget });
    registry.receive({ 'edges-gadget': edgesGadget });

    // Subscribe them to the topics
    subscriptions.receive({
      type: 'subscribe',
      topic: 'reactflow:nodes',
      subscriber: 'nodes-gadget'
    });
    subscriptions.receive({
      type: 'subscribe',
      topic: 'reactflow:edges',
      subscriber: 'edges-gadget'
    });
  }

  // Always send initial state to transformers after they're wired up
  // This ensures they have data even if component re-renders
  React.useEffect(() => {
    const initialNodeData = {
      registry: registry.current(),
      positions: positionsGadget.current(),
      nodeTypes: nodeTypesGadget.current(),
      nodeData: nodeDataGadget.current()
    };
    nodeTransformer.receive(initialNodeData);

    const initialEdgeData = {
      subscriptions: subscriptions.current()
    };
    edgeTransformer.receive(initialEdgeData);
  }, [registry, positionsGadget, nodeTypesGadget, nodeDataGadget, nodeTransformer, subscriptions, edgeTransformer]);

  // Handle node changes (position updates from React Flow)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // First, we need to apply the changes to React Flow's internal state
    // This is critical for drag functionality to work
    const updatedNodes = applyNodeChanges(changes, nodes);

    // Send the updated nodes back through the gadget system
    // This will trigger the transformers to re-emit through pubsub
    const positionUpdates: Record<string, { x: number; y: number }> = {};

    changes.forEach(change => {
      // NodeAddChange doesn't have an id
      if (change.type === 'add') return;
      if (!('id' in change)) return;

      if (change.type === 'position' && change.position && !change.dragging) {
        // Only update positions when dragging is finished
        positionUpdates[change.id] = change.position;
      }

      if (change.type === 'position' && change.dragging !== undefined) {
        // Update the node's dragging state in React Flow
        const node = updatedNodes.find(n => n.id === change.id);
        if (node) {
          node.dragging = change.dragging;
        }
      }
    });

    // Update the nodes gadget with the new state
    nodesGadget.receive(updatedNodes);

    // Update positions in the gadget system when dragging is done
    if (Object.keys(positionUpdates).length > 0) {
      sendPositions(positionUpdates);
    }
  }, [nodes, nodesGadget, sendPositions]);

  // Handle edge changes
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Apply the changes to React Flow's internal state
    const updatedEdges = applyEdgeChanges(changes, edges);
    // Update the edges gadget with the new state
    edgesGadget.receive(updatedEdges);
  }, [edges, edgesGadget]);

  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      // Subscribe target to source's events
      subscriptions.receive({
        type: 'subscribe',
        topic: `${connection.source}:increment`,
        subscriber: connection.target
      });
    }
  }, [subscriptions]);

  // Handle node clicks - increment counter
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const currentData = nodeData[node.id];
    if (currentData) {
      const newValue = (currentData.value || 0) + 1;

      // Update node data
      sendNodeData({
        [node.id]: {
          ...currentData,
          value: newValue
        }
      });

      // Update the actual gadget value
      const gadget = registry.current()[node.id];
      if (gadget) {
        gadget.receive(newValue);
      }
    }
  }, [nodeData, sendNodeData, registry]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
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