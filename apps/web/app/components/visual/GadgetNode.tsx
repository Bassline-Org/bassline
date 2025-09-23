/**
 * React Flow custom node component for gadgets
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useGadget } from 'port-graphs-react';
import type { NodeGadgets } from '../../gadgets/visual/types';

/**
 * Props for the GadgetNode component
 */
interface GadgetNodeProps<TNodeGadgets extends NodeGadgets> {
  id: string;
  data: {
    label: any; // TypedGadget but avoiding import issues
    ports: any;
    logic: any;
    style?: any;
    nodeType?: string; // For special rendering
  };
  selected?: boolean;
}

/**
 * Custom node component for React Flow
 */
export function GadgetNode<TNodeGadgets extends NodeGadgets>({
  id,
  data,
  selected
}: GadgetNodeProps<TNodeGadgets>) {
  const [label] = useGadget(data.label);
  const [ports] = useGadget(data.ports);
  const [logicState] = useGadget(data.logic);
  const [style] = data.style ? useGadget(data.style) : [{}];

  // Special rendering for counter nodes
  const renderContent = () => {
    if (data.nodeType === 'counter' && logicState) {
      return (
        <div className="node-content">
          <div className="text-2xl font-bold text-center">
            {logicState.count || 0}
          </div>
          <button
            className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              data.logic.receive({ increment: {} });
            }}
          >
            Increment
          </button>
        </div>
      );
    }

    // Special rendering for display nodes
    if (data.nodeType === 'display' && logicState) {
      return (
        <div className="node-content">
          <div className="text-lg text-center p-4 bg-white rounded">
            {logicState.value !== null ? String(logicState.value) : '(empty)'}
          </div>
        </div>
      );
    }

    // Default rendering
    return (
      <div className="node-content p-2">
        <pre className="text-xs">
          {JSON.stringify(logicState, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div
      className={`gadget-node bg-white border-2 rounded-lg shadow-lg ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}
      style={{
        minWidth: 150,
        ...style
      }}
    >
      <div className="node-header bg-gray-100 px-3 py-1 rounded-t-lg border-b">
        <div className="font-semibold text-sm">{label?.text || 'Node'}</div>
      </div>

      {renderContent()}

      {/* Render input ports */}
      {ports?.inputs?.map((port: any, index: number) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          style={{
            top: 40 + index * 25,
            background: '#555',
            width: 8,
            height: 8
          }}
        >
          <div className="absolute left-3 text-xs text-gray-600">
            {port.name}
          </div>
        </Handle>
      ))}

      {/* Render output ports */}
      {ports?.outputs?.map((port: any, index: number) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          style={{
            top: 40 + index * 25,
            background: '#555',
            width: 8,
            height: 8
          }}
        >
          <div className="absolute right-3 text-xs text-gray-600">
            {port.name}
          </div>
        </Handle>
      ))}
    </div>
  );
}