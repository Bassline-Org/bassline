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
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadget, TopicsProvider, useTopics } from 'port-graphs-react';
import { lastMap, createGadget, changed, noop } from 'port-graphs';
import _ from 'lodash';

const nodeTypes = {
  gadget: NodeGadget
};

type CustomNodeChange = NodeChange | { type: 'update', node: Node };

const createNodes = createGadget<Node[], CustomNodeChange>(
  (current, incoming) => {
    console.log('incoming', incoming);
    if (incoming.type === 'update') {
      return { action: 'update', context: { nodes: current, node: incoming } };
    }
    const inc = incoming as NodeChange;
    switch (inc.type) {
      case 'add':
        if (inc.index && current[inc.index]) {
          return null;
        }
        return { action: 'add', context: { nodes: current, node: inc.item, index: inc.index || -1 } };
      case 'remove':
        return { action: 'remove', context: { nodes: current, node: inc.id } };
      case 'position':
        return { action: 'move', context: { nodes: current, node: inc.id } };
      case 'select':
        return { action: 'select', context: { nodes: current, node: inc.id, selected: inc.selected } };
      case 'replace':
        return { action: 'replace', context: { nodes: current, node: inc.item } };
      case 'dimensions':
        return null;
    }
  },
  {
    'add': (gadget, { nodes, node }) => {
      console.log('add', node);
      const state = _.unionBy([node], nodes, 'id');
      gadget.update(state);
      return changed(state);
    },
    'remove': (gadget, { nodes, node }) => {
      console.log('remove', node);
      const state = nodes.filter((n: Node) => n.id !== node);
      gadget.update(state);
      return changed(state);
    },
    'move': (gadget, { nodes, node }) => {
      console.log('move', node);
      const state = nodes.map((n: Node) => n.id === node ? { ...n, position: n.position } : n);
      gadget.update(state);
      return changed(state);
    },
    'update': (gadget, { nodes, node }) => {
      console.log('update', node);
      const state = nodes.map((n: Node) => n.id === node ? { ...n, position: n.position } : n);
      gadget.update(state);
      return changed(state);
    },
    'select': (gadget, { nodes, node, selected }) => {
      const state = nodes.map((n: Node) => n.id === node ? { ...n, selected: selected } : n);
      gadget.update(state);
      return changed(state);
    },
    'replace': (gadget, { nodes, node }) => {
      const state = nodes.map((n: Node) => n.id === node.id ? node : n);
      gadget.update(state);
      return changed(state);
    }
  }
);

const createEdges = createGadget<Edge[], EdgeChange | Edge>(
  (current, incoming) => {
    if (!incoming.type) {
      return { action: 'update', context: { edges: current, edge: incoming } };
    }
    const inc = incoming as EdgeChange;
    switch (inc.type) {
      case 'add':
        return { action: 'add', context: { edges: current, edge: inc.item } };
      case 'remove':
        return { action: 'remove', context: { edges: current, edge: inc.id } };
      case 'select':
        return { action: 'select', context: { edges: current, edge: inc.id } };
      case 'replace':
        return { action: 'replace', context: { edges: current, edge: inc.item } };
    }
  },
  {
    'add': (gadget, { edges, edge }) => {
      const state = [...edges, edge];
      gadget.update(state);
      return changed(state);
    },
    'remove': (gadget, { edges, edge }) => {
      const state = edges.filter((e: Edge) => e.id !== edge);
      gadget.update(state);
      return changed(state);
    },
    'select': (gadget, { edges, edge }) => {
      const state = edges.map((e: Edge) => e.id === edge ? { ...e, selected: true } : e);
      gadget.update(state);
      return changed(state);
    },
    'replace': (gadget, { edges, edge }) => {
      const state = edges.map((e: Edge) => e.id === edge.id ? edge : e);
      gadget.update(state);
      return changed(state);
    },
    'update': (gadget, { edges, edge }) => {
      const state = edges.map((e: Edge) => e.id === edge.id ? edge : e);
      gadget.update(state);
      return changed(state);
    }
  }
);

// Node gadget component
function NodeGadget({ id, data: { initial } }: { id: string; data: { initial: Record<string, any> } }) {
  const topics = useTopics();
  const [state, , nodeGadget] = useGadget(lastMap, { initial });

  useEffect(() => {
    topics.subscribe([`node:${id}`], nodeGadget);
    topics.publish(['node:changes'], { id, type: 'gadget', data: { initial } });
  }, [topics, id, nodeGadget]);

  useEffect(() => {
    topics.publish(['node:changes'], state);
  }, [topics, state]);

  return <>
    <div>{JSON.stringify(state)}</div>
  </>
}

// Edge gadget component
function EdgeGadget({ id, initial }: { id: string; initial: Edge }) {
  const topics = useTopics();
  const [state, , edgeGadget] = useGadget(lastMap, initial);

  useEffect(() => {
    topics.subscribe([`edge:${id}`], edgeGadget);
  }, [topics, id, edgeGadget]);

  useEffect(() => {
    topics.publish(['edge:changes'], state);
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
    console.log('onNodesChange', changes);
    for (const change of changes) {
      topics.publish([`node:changes`], change);
    }
  }, [topics]);

  // Handle edge changes - just publish them as data
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const change of changes) {
      topics.publish([`edge:changes`], change);
    }
  }, [topics]);

  // Handle new connections
  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      const newEdge: Edge = {
        id: `${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
      };
      topics.publish([`edge:${newEdge.id}`], newEdge);
    }
  }, [topics]);

  // Initialize demo data
  useEffect(() => {
    ['node-1', 'node-2', 'node-3'].forEach((id, i) => {
      topics.publish([`node:changes`], {
        type: 'add',
        item: {
          id,
          type: 'gadget',
          position: { x: 100 + i * 150, y: 100 },
          data: { label: `Node ${i + 1}` }
        },
      });
    });
  }, []);

  return (
    <>
      <div style={{ width: '100vw', height: '100vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          // onEdgesChange={onEdgesChange}
          // onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      <TopicsProvider>
        <CanvasContent />
      </TopicsProvider>
    </ReactFlowProvider>
  );
}