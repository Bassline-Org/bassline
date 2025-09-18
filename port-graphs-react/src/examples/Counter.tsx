/**
 * Example: Counter component using maxCell gadget
 *
 * Demonstrates how a cell gadget can be used in React with tapping for effects
 */

import React from 'react';
import { useGadget, useTap } from '../index';
import { maxCell } from 'port-graphs/cells';

export function CounterExample() {
  // Create a maxCell gadget - automatically tappable!
  const [count, send, counter] = useGadget(
    maxCell,
    0
  );

  // Tap into emissions for logging
  useTap(counter, (effect) => {
    console.log('Counter emitted:', effect);
  });

  const handleIncrement = () => {
    // Send a higher value to the maxCell
    send(count + 1);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>MaxCell Counter (Tappable)</h2>
      <p>Current value: <strong>{count}</strong></p>
      <p style={{ fontSize: '0.9em', color: '#666' }}>
        Note: maxCell only updates to higher values!
      </p>

      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button onClick={handleIncrement}>
          Increment (+1)
        </button>

        <button onClick={() => send(10)}>
          Set to 10
        </button>

        <button onClick={() => send(5)}>
          Set to 5 (won't work if above 5)
        </button>

        <button onClick={() => send(100)}>
          Set to 100
        </button>
      </div>
    </div>
  );
}

/**
 * Example showing parent-child tapping
 */
export function ParentChildExample() {
  const [parentValue, , parentGadget] = useGadget(maxCell, 0);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Parent Counter</h2>
      <p>Parent value: <strong>{parentValue}</strong></p>
      <button onClick={() => parentGadget.receive(parentValue + 1)}>
        Parent +1
      </button>

      <ChildCounter source={parentGadget} />
    </div>
  );
}

function ChildCounter({ source }: { source: any }) {
  const [childValue, , childGadget] = useGadget(maxCell, 0);

  // Child taps into parent's effects
  useTap(source, (effect) => {
    if (effect && 'changed' in effect) {
      console.log('Parent changed to:', effect.changed);
      // Child receives parent's value
      childGadget.receive(effect.changed);
    }
  });

  return (
    <div style={{ marginTop: '20px', padding: '10px', background: '#f0f0f0' }}>
      <h3>Child Counter</h3>
      <p>Child value (follows parent): <strong>{childValue}</strong></p>
    </div>
  );
}