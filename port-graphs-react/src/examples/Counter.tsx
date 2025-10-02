/**
 * Counter Example - Basic reactive state with useLocalGadget
 *
 * Demonstrates:
 * - Creating component-local gadgets
 * - Using .receive() in event handlers
 * - Rendering reactive values
 */

import React from 'react';
import { useLocalGadget, cells } from '../';

export function Counter() {
  const [count, counter] = useLocalGadget(() => cells.max(0));

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Counter Example</h3>
      <p>Count: {count}</p>
      <button onClick={() => counter.receive(count + 1)}>
        Increment
      </button>
      <button onClick={() => counter.receive(count + 10)}>
        +10
      </button>
      <button onClick={() => counter.receive(0)}>
        Reset
      </button>
    </div>
  );
}
