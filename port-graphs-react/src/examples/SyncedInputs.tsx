/**
 * SyncedInputs Example - Bidirectional synchronization
 *
 * Demonstrates:
 * - Using .sync() to wire gadgets bidirectionally
 * - Ordinal cells for versioned values
 * - useEffect for wiring with cleanup
 * - Changes in one input reflected in the other
 */

import React, { useEffect } from 'react';
import { useLocalGadget, cells } from '../';

export function SyncedInputs() {
  const [value1, cell1] = useLocalGadget(() => cells.ordinal('Hello'));
  const [value2, cell2] = useLocalGadget(() => cells.ordinal('Hello'));

  // Bidirectionally sync the cells
  useEffect(() => {
    const cleanup = cell1.sync(cell2);
    return cleanup;
  }, [cell1, cell2]);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Synced Inputs Example</h3>
      <p>These inputs are bidirectionally synced. Change one and see the other update!</p>
      <div>
        <label>
          Input 1:
          <input
            value={value1[1]}
            onChange={e => cell1.receive([value1[0] + 1, e.target.value])}
          />
        </label>
        <small> (version: {value1[0]})</small>
      </div>
      <div>
        <label>
          Input 2:
          <input
            value={value2[1]}
            onChange={e => cell2.receive([value2[0] + 1, e.target.value])}
          />
        </label>
        <small> (version: {value2[0]})</small>
      </div>
    </div>
  );
}
