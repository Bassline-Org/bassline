/**
 * DerivedSum Example - Computed values with useDerive
 *
 * Demonstrates:
 * - Multiple source cells
 * - Derived computation from multiple sources
 * - Automatic updates when sources change
 * - Passing gadgets (not values) to useDerive
 */

import React from 'react';
import { useLocalGadget, useDerive, cells } from '../';

export function DerivedSum() {
  const [a, cellA] = useLocalGadget(() => cells.max(0));
  const [b, cellB] = useLocalGadget(() => cells.max(0));
  const [c, cellC] = useLocalGadget(() => cells.max(0));

  // Derive sum from multiple sources - requires gadgets!
  const [sum] = useDerive(
    { a: cellA, b: cellB, c: cellC },
    ({ a, b, c }) => a + b + c
  );

  // Derive product
  const [product] = useDerive(
    { a: cellA, b: cellB },
    ({ a, b }) => a * b
  );

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Derived Sum Example</h3>
      <div>
        <label>
          A: <input type="number" value={a} onChange={e => cellA.receive(+e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          B: <input type="number" value={b} onChange={e => cellB.receive(+e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          C: <input type="number" value={c} onChange={e => cellC.receive(+e.target.value)} />
        </label>
      </div>
      <hr />
      <p><strong>Sum (A + B + C):</strong> {sum}</p>
      <p><strong>Product (A × B):</strong> {product}</p>
    </div>
  );
}
