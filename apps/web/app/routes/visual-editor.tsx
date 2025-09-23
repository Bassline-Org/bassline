/**
 * Visual editor demo route
 */

import type { Route } from './+types/visual-editor';
import { GadgetProvider, useGadget } from 'port-graphs-react';
import { NodeCanvas, type NodeGadgets } from '../components/visual/NodeCanvas';
import { createCounterNode, createDisplayNode } from '../gadgets/visual/node-factory';
import { lastCell, lastMap, tableCell } from 'port-graphs/cells';
import { withTaps, type Tappable } from 'port-graphs';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: 'Visual Editor - Port Graphs' },
    { name: 'description', content: 'Visual gadget editor with React Flow' }
  ];
}

const nodeTable = withTaps(tableCell<string, Tappable<{ changed: any }> & NodeGadgets<any, any>>({}));
nodeTable.tap(({ added }) => {
  if (added) {
    Object.values(added).forEach(gadget => {
      gadget.tap(({ changed }) => {
        if (changed) {
          console.log('changed', changed);
        }
      });
    });
  }
});

const exampleGadget = withTaps(lastMap({}));

const foo = withTaps(lastMap({
  position: withTaps(lastCell({ x: 0, y: 0 })),
  selected: withTaps(lastCell(false)),
  gadget: exampleGadget,
}));

const bar = withTaps(lastMap({
  position: withTaps(lastCell({ x: 100, y: 100 })),
  selected: withTaps(lastCell(true)),
  gadget: exampleGadget,
}));

nodeTable.receive({
  'foo': foo,
  'bar': bar,
});

function VisualEditorInner() {
  const [nodeTableState, , nodeTableCell] = useGadget(nodeTable);
  const [fooState, ,] = useGadget(foo);
  const [barState, ,] = useGadget(bar);

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
          nodeTable={nodeTableCell}
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