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
import { type CellSpec, type TypedGadget } from 'port-graphs';

// Define node types for React Flow
const nodeTypes = {};

interface Position {
  x: number;
  y: number;
}

export interface NodeGadgets {
  id: TypedGadget<CellSpec<string, string>>,
  position: TypedGadget<CellSpec<Position, Position>>,
  gadget: TypedGadget<any>,
}

export interface NodeCanvasProps {
  nodeTable: NodeGadgets[];
}

export function NodeCanvas({
  nodeTable,
}: NodeCanvasProps) {
  const [nodeState, , nodeTableCell] = useGadget(nodeTable);

  const nodes = Object.entries(nodeState).map(([id, { position, gadget }]) => {
    return {
      id,
      type: 'default',
      position: position.current(),
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
        nodeState[change.id]?.position.receive(change.position as Position);
      }
      // if (change.type === 'select') {
      //   console.log('node select', change, nodeState[change.id]?.selected);
      //   nodeState[change.id]?.selected.receive(change.selected);
      // }
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