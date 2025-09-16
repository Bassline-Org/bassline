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
  MiniMap,
  Background,
  BackgroundVariant,
  type Node,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadget, TopicsProvider, useTopics } from 'port-graphs-react';
import { lastMap, createGadget, changed } from 'port-graphs';
import _ from 'lodash';

const nodeTypes = {
  gadget: NodeGadget
};

const edgeTypes = {
  gadget: EdgeGadget
}

const createNodes = createGadget<Node[], NodeChange[]>(
  (current, incoming) => {
    return { action: 'update', context: { nodes: current, changes: incoming } };
  },
  {
    'update': (gadget, { nodes, changes }) => {
      const updated = applyNodeChanges(changes, nodes);
      gadget.update(updated);
      return changed(updated);
    }
  }
);

const createEdges = createGadget<Edge[], EdgeChange[]>(
  (current, incoming) => {
    return { action: 'update', context: { edges: current, changes: incoming } };
  },
  {
    'update': (gadget, { edges, changes }) => {
      const state = applyEdgeChanges(changes, edges);
      gadget.update(state);
      return changed(state);
    }
  }
);

// Node gadget component
function NodeGadget({ id, data }: { id: string; data: Record<string, any> }) {
  const topics = useTopics();
  const fullNode = { id, type: 'gadget', position: { x: 0, y: 0 }, data };
  const [state, updateState, nodeGadget] = useGadget(lastMap, fullNode);

  useEffect(() => {
    topics.subscribe([`node:${id}`], nodeGadget);
  }, [topics, id, nodeGadget]);

  useEffect(() => {
    // Publish the full node state when it changes
    if (state && state['id']) {
      console.log('node changed', state);
      topics.publish(['node:changes'], [{ type: 'replace', id: state['id'], item: state }]);
    }
  }, [topics, state]);

  return <>
    <div onContextMenu={(e) => {
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

  useEffect(() => {
    topics.subscribe([`edge:${id}`], edgeGadget);
  }, [topics, id, edgeGadget]);

  useEffect(() => {
    topics.publish(['edge:changes'], [{ type: 'replace', id: state['id'], item: state }]);
  }, [topics, state]);

  return null;
}

function CanvasContent() {
  const topics = useTopics();

  const [nodes, , nodesGadget] = useGadget(createNodes, []);
  const [edges, , edgesGadget] = useGadget(createEdges, []);

  // Subscribe aggregators
  useEffect(() => {
    topics.subscribe(['node:changes'], nodesGadget);
    topics.subscribe(['edge:changes'], edgesGadget);
  }, [topics, nodesGadget, edgesGadget]);

  // Handle node changes - just publish them as data
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    topics.publish([`node:changes`], changes);
  }, [topics]);

  // Handle edge changes - just publish them as data
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    topics.publish([`edge:changes`], changes);
  }, [topics]);

  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      const newEdge: Edge = {
        id: `${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
      };
      topics.publish([`edge:changes`], [{ type: 'add', item: newEdge }]);
    }
  }, [topics]);

  // Initialize demo data - just add the nodes, NodeGadget components will handle their state
  useEffect(() => {
    ['node-1', 'node-2', 'node-3'].forEach((id, i) => {
      topics.publish([`node:changes`], [{
        type: 'add',
        item: {
          id,
          type: 'gadget',
          position: { x: 100 + i * 150, y: 100 },
          data: { label: `Node ${i + 1}` }
        },
      }]);
    });
  }, [topics]);

  return (
    <>
      <div style={{ width: '100vw', height: '100vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Controls />
          {/* <MiniMap /> */}
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
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