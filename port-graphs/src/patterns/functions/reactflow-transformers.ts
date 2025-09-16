/**
 * Transformer gadgets that convert gadget system state to React Flow format
 * These are designed to work with the pubsub system, publishing to specific topics
 */

import { createFn } from './numeric';
import type { Gadget } from '../../core';
import { changed } from '../../effects';

// React Flow types (simplified for our use)
export type ReactFlowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: any;
  dragging?: boolean;
  selected?: boolean;
};

export type ReactFlowEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
};

export type Positions = Record<string, { x: number; y: number }>;
export type NodeTypes = Record<string, string>;
export type NodeData = Record<string, any>;
export type Registry = Record<string, Gadget>;
export type Subscriptions = Record<string, string[]>;

/**
 * Node transformer - converts registry + visual properties to React Flow nodes
 * Designed to publish to 'reactflow:nodes' topic
 */
export const createNodeTransformer = () => {
  return createFn<
    {
      registry: Registry;
      positions: Positions;
      nodeTypes: NodeTypes;
      nodeData: NodeData;
    },
    ReactFlowNode[]
  >(
    ({ registry, positions, nodeTypes, nodeData }) => {
      const nodes: ReactFlowNode[] = [];

      // Convert each gadget in registry to a React Flow node
      for (const [gadgetId] of Object.entries(registry)) {
        const position = positions[gadgetId] || { x: 0, y: 0 };
        const type = nodeTypes[gadgetId] || 'default';
        const data = nodeData[gadgetId] || { label: gadgetId };

        nodes.push({
          id: gadgetId,
          type,
          position,
          data
        });
      }

      return nodes;
    },
    ['registry', 'positions', 'nodeTypes', 'nodeData']
  );
};

/**
 * Edge transformer - converts subscriptions to React Flow edges
 * Designed to publish to 'reactflow:edges' topic
 */
export const createEdgeTransformer = () => {
  return createFn<
    {
      subscriptions: Subscriptions;
    },
    ReactFlowEdge[]
  >(
    ({ subscriptions }) => {
      const edges: ReactFlowEdge[] = [];

      // For each topic and its subscribers
      for (const [topic, subscribers] of Object.entries(subscriptions)) {
        // Extract the publisher from the topic (assuming format "gadgetId:eventType")
        const [publisherId] = topic.split(':');
        if (!publisherId) continue;

        // Create edge from publisher to each subscriber
        for (const subscriberId of subscribers) {
          edges.push({
            id: `${publisherId}-${subscriberId}`,
            source: publisherId,
            target: subscriberId,
            label: topic
          });
        }
      }

      return edges;
    },
    ['subscriptions']
  );
};

/**
 * Create a node transformer that also publishes to the pubsub system
 * This wraps the transformer to emit changes as effects
 */
export const createPublishingNodeTransformer = () => {
  const transformer = createNodeTransformer();

  return (initial: any) => {
    const gadget = transformer(initial);

    // Override emit to publish nodes
    const originalEmit = gadget.emit;
    gadget.emit = (effect) => {
      originalEmit(effect);
      // When the transformer computes new nodes, emit them as a changed effect
      if (Array.isArray(effect)) {
        gadget.emit(changed(effect));
      }
    };

    return gadget;
  };
};

/**
 * Create an edge transformer that also publishes to the pubsub system
 */
export const createPublishingEdgeTransformer = () => {
  const transformer = createEdgeTransformer();

  return (initial: any) => {
    const gadget = transformer(initial);

    // Override emit to publish edges
    const originalEmit = gadget.emit;
    gadget.emit = (effect) => {
      originalEmit(effect);
      // When the transformer computes new edges, emit them as a changed effect
      if (Array.isArray(effect)) {
        gadget.emit(changed(effect));
      }
    };

    return gadget;
  };
};