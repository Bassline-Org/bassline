/**
 * Main canvas component for visual gadget editor
 */

import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGadget } from 'port-graphs-react';
import { type CellSpec, type PartialSpec, type TableSpec, type Tappable, type TypedGadget } from 'port-graphs';
import { GadgetNode } from './GadgetNode';

// Define node types for React Flow
const nodeTypes = {
};

type Position = {
  x: number;
  y: number;
}
export type PositionSpec = CellSpec<Position, Position>;

export type NodeGadgets<T extends PartialSpec = PartialSpec> = {
  position: TypedGadget<Tappable & PositionSpec>;
  selected: TypedGadget<Tappable & CellSpec<boolean, boolean>>;
  gadget: TypedGadget<Tappable & T>;
};


/**
 * Canvas component that integrates React Flow with gadgets
 */
interface NodeCanvasProps {
  nodeTable: TypedGadget<TableSpec<NodeGadgets>>;
}

export function NodeCanvas({
  nodeTable,
}: NodeCanvasProps) {
  const [nodeState, , nodeTableCell] = useGadget(nodeTable);

  const nodes = Object.entries(nodeState).map(([id, instance]) => {
    const { position, selected, gadget } = instance.current();
    return {
      id,
      type: 'default',
      position: position.current(),
      selected: selected.current(),
      data: {
        gadget: gadget.current(),
      }
    }
  });

  // For now, no edges
  const edges: Edge[] = [];

  // Handle node changes from React Flow
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      console.log('node change', change);
      if (change.type === 'position') {
        nodeState[change.id]?.current().position.receive(change.position as Position);
      }
      if (change.type === 'select') {
        console.log('node select', change, nodeState[change.id]?.current().selected);
        nodeState[change.id]?.current().selected.receive(change.selected);
      }
      if (change.type === 'remove') {
        nodeTableCell.receive({ [change.id]: null });
      }
    }
  }, [nodeTableCell]);

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
        fitView
      >
        <Background color="#aaa" gap={16} variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}