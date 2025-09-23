/**
 * Visual editor demo route
 */

import type { Route } from './+types/visual-editor';
import { GadgetProvider } from 'port-graphs-react';
import { NodeCanvas } from '../components/visual/NodeCanvas';
import { nodeCommandCell } from '../gadgets/visual/node-command-cell';
import { positionCell } from '../gadgets/visual/position-cell';
import { selectionCell } from '../gadgets/visual/selection-cell';
import { createCounterNode, createDisplayNode } from '../gadgets/visual/node-factory';
import type { NodeRegistry } from '../gadgets/visual/types';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: 'Visual Editor - Port Graphs' },
    { name: 'description', content: 'Visual gadget editor with React Flow' }
  ];
}

// Create gadgets OUTSIDE components - they're singletons!
const commands = nodeCommandCell();
const positions = positionCell({
  'counter-1': { x: 100, y: 100 },
  'display-1': { x: 400, y: 100 }
});
const selections = selectionCell({});

// Create initial nodes with proper typing
const counterNode = createCounterNode('counter-1', 0);
const displayNode = createDisplayNode('display-1', null);

// Build the registry - nodes are properly typed now
const nodeInstances: NodeRegistry = {
  'counter-1': counterNode,
  'display-1': displayNode
};

// Wire counter to display with proper types
// We have direct access to the properly typed nodes
counterNode.gadgets.logic.tap((effect) => {
  if ('changed' in effect && effect.changed !== undefined) {
    displayNode.gadgets.logic.receive({ display: effect.changed });
  }
});

function VisualEditorInner() {

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold">Visual Gadget Editor</h1>
        <p className="text-sm opacity-75">
          Click the counter to increment it. The display shows the count.
        </p>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <NodeCanvas
          nodeInstances={nodeInstances}
          positions={positions}
          selections={selections}
          commands={commands}
        />
      </div>

      <div className="bg-gray-100 p-4 border-t">
        <div className="flex gap-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => {
              // Add new counter node
              const id = `counter-${Date.now()}`;
              const newNode = createCounterNode(id, 0);
              // Would need to update nodeInstances state here
              console.log('Would add new counter node:', id, newNode);
            }}
          >
            Add Counter
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => {
              // Add new display node
              const id = `display-${Date.now()}`;
              const newNode = createDisplayNode(id, null);
              // Would need to update nodeInstances state here
              console.log('Would add new display node:', id, newNode);
            }}
          >
            Add Display
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VisualEditor() {
  return (
    <GadgetProvider>
      <VisualEditorInner />
    </GadgetProvider>
  );
}