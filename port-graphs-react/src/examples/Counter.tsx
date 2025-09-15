/**
 * Example: Counter component using maxCell gadget
 *
 * Demonstrates how a cell gadget can be used in React with bidirectional updates
 */

import React from 'react';
import { useGadget, useGadgetEffect } from '../index';
import { maxCell } from 'port-graphs/dist/patterns/cells/numeric';

export function CounterExample() {
  // Create a maxCell gadget that's managed by React state
  const [count, counter] = useGadget(
    (initial) => maxCell(initial),
    0
  );

  // Handle emissions from the gadget (for logging)
  useGadgetEffect(
    counter,
    (effect) => {
      console.log('Counter emitted:', effect);
    },
    []
  );

  const handleIncrement = () => {
    // Send a higher value to the maxCell
    counter?.receive(count + 1);
  };

  const handleSet = (value: number) => {
    // maxCell will only update if this is higher than current
    counter?.receive(value);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>MaxCell Counter</h2>
      <p>Current value: <strong>{count}</strong></p>
      <p style={{ fontSize: '0.9em', color: '#666' }}>
        Note: maxCell only updates to higher values!
      </p>

      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button onClick={handleIncrement}>
          Increment (+1)
        </button>

        <button onClick={() => handleSet(10)}>
          Set to 10
        </button>

        <button onClick={() => handleSet(5)}>
          Set to 5 (won't work if above 5)
        </button>

        <button onClick={() => handleSet(100)}>
          Set to 100
        </button>
      </div>
    </div>
  );
}