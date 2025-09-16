/**
 * Canvas route - React Flow canvas with proper gadget architecture
 *
 * Each node is a gadget that subscribes to node:{id} for updates
 * and broadcasts its state to reactflow:nodes
 */

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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadget, TopicsProvider, useTopics, useGadgetSubscription } from 'port-graphs-react';
import { lastMap, aggregatorCell } from 'port-graphs';
import { topic } from 'port-graphs/meta';
import _ from 'lodash';

const nodeTypes = {
  gadget: NodeGadget,
};

const edgeTypes = {
  gadget: EdgeGadget
}

// Helper to process ReactFlow changes through aggregator
const processNodeChanges = (nodes: Node[], changes: NodeChange[]): Node[] => {
  return applyNodeChanges(changes, nodes);
};

const processEdgeChanges = (edges: Edge[], changes: EdgeChange[]): Edge[] => {
  return applyEdgeChanges(changes, edges);
};

// Node gadget component
function NodeGadget({ id, data }: { id: string; data: Record<string, any> }) {
  const topics = useTopics();
  const fullNode = { id, type: 'gadget', position: { x: 0, y: 0 }, data };
  const [state, updateState, nodeGadget] = useGadget(lastMap, fullNode);

  // Subscribe to node-specific updates
  useGadgetSubscription([topic.node(id)], nodeGadget, [id]);

  useEffect(() => {
    // Publish the full node state when it changes
    if (state && state['id']) {
      console.log('node changed', state);
      topics.publish([topic.changes('node')], { type: 'replace', id: state['id'], item: state });
    }
    if (state['data']['bg-key']) {
      console.log('bg key changed', state['data']['bg-key'], state['position']['x']);
      topics.publish([topic.build('bg')], { [state['data']['bg-key']]: state['position']['x'] });
    }
  }, [topics, state]);

  return <>
    <div onContextMenu={(e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('context menu');
      updateState({ position: { x: state['position']['x'] + 100, y: state['position']['y'] + 100 } });
    }}>{data['label'] || id}</div>
  </>
}

// Edge gadget component
function EdgeGadget({ id, data }: { id: string; data: Record<string, any> }) {
  const topics = useTopics();
  const [state, , edgeGadget] = useGadget(lastMap, { id, type: 'gadget', data });

  // Subscribe to edge-specific updates
  useGadgetSubscription([topic.edge(id)], edgeGadget, [id]);

  useEffect(() => {
    topics.publish([topic.changes('edge')], { type: 'replace', id: state['id'], item: state });
  }, [topics, state]);

  return null;
}

function CanvasContent() {
  const topics = useTopics();

  // Use aggregator cells for managing collections
  const [nodeState, sendNodeChange, nodesGadget] = useGadget(aggregatorCell<Node>(), []);
  const [edgeState, sendEdgeChange, edgesGadget] = useGadget(aggregatorCell<Edge>(), []);
  const [bg, , bgGadget] = useGadget(lastMap, { red: 0, green: 0, blue: 0 });

  // Process ReactFlow changes through nodes/edges state
  const nodes = nodeState;
  const edges = edgeState;

  // Subscribe aggregators to topics
  useGadgetSubscription([topic.changes('node')], nodesGadget);
  useGadgetSubscription([topic.changes('edge')], edgesGadget);
  useGadgetSubscription([topic.build('bg')], bgGadget);

  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      const newEdge: Edge = {
        id: `${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
      };
      topics.publish([topic.changes('edge')], { type: 'add', item: newEdge });
    }
  }, [topics]);

  const keys = ['red', 'green', 'blue'];

  // Initialize demo data - just add the nodes, NodeGadget components will handle their state
  useEffect(() => {
    ['node-1', 'node-2', 'node-3'].forEach((id, i) => {
      topics.publish([topic.changes('node')], {
        type: 'add',
        item: {
          id,
          type: 'gadget',
          position: { x: 100 + i * 150, y: 100 },
          data: { label: `Node ${i + 1}`, 'bg-key': keys[i] }
        },
      });
    });
  }, [topics]);

  return (
    <>
      <div style={{ width: '100vw', height: '100vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes: NodeChange[]) => {
            // Process changes and send to aggregator
            const processed = processNodeChanges(nodes, changes);
            processed.forEach(node => {
              sendNodeChange({ type: 'replace', id: node.id, item: node });
            });
          }}
          onEdgesChange={(changes: EdgeChange[]) => {
            // Process changes and send to aggregator
            const processed = processEdgeChanges(edges, changes);
            processed.forEach(edge => {
              sendEdgeChange({ type: 'replace', id: edge.id, item: edge });
            });
          }}
          onNodeDrag={(_e, node) => {
            topics.publish([topic.node(node.id)], node);
          }}
          onNodeClick={(_e, node) => {
            topics.publish([topic.node(node.id)], node);
          }}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Controls />
          {/* <MiniMap /> */}
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} bgColor={`rgb(${bg['red']}, ${bg['green']}, ${bg['blue']})`} />
        </ReactFlow>
      </div>
    </>
  );
}

export default function Canvas() {
  return (
    <TopicsProvider>
      <CanvasContent />
    </TopicsProvider>
  );
}