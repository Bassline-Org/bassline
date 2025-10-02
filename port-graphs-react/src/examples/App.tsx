/**
 * Demo App - All examples in one place
 */

import React from 'react';
import { Counter } from './Counter';
import { DerivedSum } from './DerivedSum';
import { SyncedInputs } from './SyncedInputs';
import { SharedState } from './SharedState';
import { Pipeline } from './Pipeline';

export function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>port-graphs-react Examples</h1>
      <p>
        These examples demonstrate React hooks that expose sugar gadgets.
        All hooks return <code>[value, gadget]</code> tuples.
      </p>

      <Counter />
      <DerivedSum />
      <SyncedInputs />
      <SharedState />
      <Pipeline />

      <hr />
      <footer style={{ marginTop: '40px', color: '#666', fontSize: '14px' }}>
        <h4>Key Concepts:</h4>
        <ul>
          <li><strong>useGadget(gadget)</strong> - Subscribe to existing gadget (module-level)</li>
          <li><strong>useLocalGadget(factory)</strong> - Create component-local gadget</li>
          <li><strong>useDerive(sources, fn)</strong> - Computed values from multiple sources</li>
          <li><strong>Value</strong> - For rendering (count, name, result)</li>
          <li><strong>Gadget</strong> - For operations (.receive(), .sync(), .fanOut())</li>
        </ul>
      </footer>
    </div>
  );
}
