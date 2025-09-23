/**
 * Main canvas component for visual gadget editor
 */

import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadget, useGadgetEffect } from 'port-graphs-react';
import type { TypedGadget } from 'port-graphs';
import type {
  NodeRegistry,
  PositionState,
  SelectionState
} from '../../gadgets/visual/types';
import type { NodeCommandSpec } from '../../gadgets/visual/node-command-cell';
import type { PositionCellSpec } from '../../gadgets/visual/position-cell';
import type { SelectionCellSpec } from '../../gadgets/visual/selection-cell';
import { GadgetNode } from './GadgetNode';

// Define node types for React Flow
const nodeTypes = {
  'gadget-node': GadgetNode
};

/**
 * Props for NodeCanvas component
 */
interface NodeCanvasProps {
  nodeInstances: NodeRegistry;
  positions: TypedGadget<PositionCellSpec>;
  selections: TypedGadget<SelectionCellSpec>;
  commands: TypedGadget<NodeCommandSpec>;
}

/**
 * Canvas component that integrates React Flow with gadgets
 */
export function NodeCanvas({
  nodeInstances,
  positions,
  selections,
  commands
}: NodeCanvasProps) {
  const [positionState] = useGadget(positions);
  const [selectionState] = useGadget(selections);

  // Wire command cell to position and selection cells
  useGadgetEffect(commands, (effects) => {
    if ('positionsChanged' in effects && effects.positionsChanged) {
      const newPositions = { ...positionState };
      effects.positionsChanged.forEach(({ id, position }) => {
        newPositions[id] = position;
      });
      positions.receive(newPositions);
    }

    if ('selectionsChanged' in effects && effects.selectionsChanged) {
      const newSelections = { ...selectionState };
      effects.selectionsChanged.forEach(({ id, selected }) => {
        if (selected) {
          newSelections[id] = true;
        } else {
          delete newSelections[id];
        }
      });
      selections.receive(newSelections);
    }

    if ('nodesRemoved' in effects && effects.nodesRemoved) {
      // Handle node removal
      const newPositions = { ...positionState };
      const newSelections = { ...selectionState };
      effects.nodesRemoved.forEach(id => {
        delete newPositions[id];
        delete newSelections[id];
      });
      positions.receive(newPositions);
      selections.receive(newSelections);
    }
  }, [positionState, selectionState]);

  // Build React Flow nodes from gadget instances
  const nodes: Node[] = Object.entries(nodeInstances).map(([id, instance]) => ({
    id,
    type: 'gadget-node',
    position: positionState[id] || { x: 100, y: 100 },
    selected: selectionState[id] || false,
    data: {
      ...instance.gadgets,
      nodeType: instance.gadgets.label?.current?.()?.text?.toLowerCase() || undefined
    }
  }));

  // For now, no edges
  const edges: Edge[] = [];

  // Handle node changes from React Flow
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    commands.receive(changes);
  }, [commands]);

  // Handle edge changes (for future use)
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Will handle edge changes when we implement edges
  }, []);

  // Handle new connections (for future use)
  const onConnect = useCallback((connection: Connection) => {
    // Will handle new connections when we implement edges
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background color="#aaa" gap={16} variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}