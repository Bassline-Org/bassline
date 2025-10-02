/**
 * Pipeline Example - Function composition with fanOut
 *
 * Demonstrates:
 * - Function gadgets with useFunction
 * - Fan-out pattern (one source, multiple targets)
 * - Calling functions with .call()
 * - Observing computed results
 * - Wiring with .fanOut().to().build()
 */

import React, { useEffect } from 'react';
import { useFunction, fn } from '../';

export function Pipeline() {
  const [input, inputFunc] = useFunction(() => fn.map((x: number) => x * 2));
  const [branch1, branch1Func] = useFunction(() => fn.map((x: number) => x + 10));
  const [branch2, branch2Func] = useFunction(() => fn.map((x: number) => x - 5));
  const [branch3, branch3Func] = useFunction(() => fn.map((x: number) => x * x));

  // Fan out from input to all branches
  useEffect(() => {
    const cleanup = inputFunc.fanOut()
      .to(branch1Func)
      .to(branch2Func)
      .to(branch3Func)
      .build();

    return cleanup;
  }, [inputFunc, branch1Func, branch2Func, branch3Func]);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Pipeline Example</h3>
      <p>Input is fanned out to three branches:</p>
      <div>
        <button onClick={() => inputFunc.call(5)}>Process 5</button>
        <button onClick={() => inputFunc.call(10)}>Process 10</button>
        <button onClick={() => inputFunc.call(20)}>Process 20</button>
      </div>
      <hr />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <strong>Input (x × 2):</strong> {input}
        </div>
        <div></div>
        <div style={{ border: '1px dashed blue', padding: '5px' }}>
          <strong>Branch 1 (+ 10):</strong> {branch1}
        </div>
        <div style={{ border: '1px dashed green', padding: '5px' }}>
          <strong>Branch 2 (- 5):</strong> {branch2}
        </div>
        <div style={{ border: '1px dashed red', padding: '5px' }}>
          <strong>Branch 3 (× itself):</strong> {branch3}
        </div>
      </div>
    </div>
  );
}
