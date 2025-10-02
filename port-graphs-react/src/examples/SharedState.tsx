/**
 * SharedState Example - Module-level gadgets shared across components
 *
 * Demonstrates:
 * - Defining gadgets outside components (module-level)
 * - Using useGadget to subscribe to external gadgets
 * - Multiple components observing the same gadget
 * - Shared state updates reflected everywhere
 */

import React from 'react';
import { useGadget, cells } from '../';

// Module-level gadgets - shared across all component instances
const sharedCounter = cells.max(0);
const sharedName = cells.ordinal('Alice');

function CounterDisplay() {
  const [count, counter] = useGadget(sharedCounter);

  return (
    <div style={{ border: '1px dashed #666', padding: '10px', margin: '5px' }}>
      <strong>Counter Display:</strong> {count}
      <button onClick={() => counter.receive(count + 1)}>+1</button>
    </div>
  );
}

function NameEditor() {
  const [name, nameCell] = useGadget(sharedName);

  return (
    <div style={{ border: '1px dashed #666', padding: '10px', margin: '5px' }}>
      <strong>Name Editor:</strong>
      <input
        value={name[1]}
        onChange={e => nameCell.receive([name[0] + 1, e.target.value])}
      />
    </div>
  );
}

function NameDisplay() {
  const [name] = useGadget(sharedName);

  return (
    <div style={{ border: '1px dashed #666', padding: '10px', margin: '5px' }}>
      <strong>Name Display:</strong> {name[1]}
    </div>
  );
}

export function SharedState() {
  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Shared State Example</h3>
      <p>These components all share the same module-level gadgets:</p>
      <CounterDisplay />
      <CounterDisplay />
      <NameEditor />
      <NameDisplay />
    </div>
  );
}
