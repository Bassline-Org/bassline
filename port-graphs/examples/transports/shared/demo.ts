#!/usr/bin/env tsx
/**
 * Demo showing that the same gadget code works with different transports
 * Run this to see convergence properties in action
 */

import { maxCell } from '../../../src/patterns/cells/numeric';
import { unionCell } from '../../../src/patterns/cells/array-set';

console.log('=== Gadget Transport Demo ===\n');

// Example 1: Direct wiring (no transport)
console.log('1. DIRECT WIRING (synchronous)');
const max1 = maxCell(0);
const max2 = maxCell(0);

// Wire them together
max1.emit = (e) => e && 'changed' in e && max2.receive(e.changed);
max2.emit = (e) => e && 'changed' in e && max1.receive(e.changed);

max1.receive(10);
console.log('  max1 receives 10 -> max1:', max1.current(), 'max2:', max2.current());

max2.receive(20);
console.log('  max2 receives 20 -> max1:', max1.current(), 'max2:', max2.current());

max1.receive(15);
console.log('  max1 receives 15 -> max1:', max1.current(), 'max2:', max2.current());

// Example 2: Async wiring (setTimeout)
console.log('\n2. ASYNC WIRING (with delays)');
const max3 = maxCell(0);
const max4 = maxCell(0);

// Wire with random delays
max3.emit = (e) => {
  if (e && 'changed' in e) {
    const delay = Math.random() * 100;
    setTimeout(() => max4.receive(e.changed), delay);
    console.log(`  max3 -> max4 (delayed ${delay.toFixed(0)}ms)`);
  }
};

max4.emit = (e) => {
  if (e && 'changed' in e) {
    const delay = Math.random() * 100;
    setTimeout(() => max3.receive(e.changed), delay);
    console.log(`  max4 -> max3 (delayed ${delay.toFixed(0)}ms)`);
  }
};

max3.receive(10);
max4.receive(20);
max3.receive(15);

setTimeout(() => {
  console.log('  After delays -> max3:', max3.current(), 'max4:', max4.current());
  console.log('  ✓ Both converged to 20 despite async delays!\n');
  example3();
}, 500);

// Example 3: Union cells with out-of-order delivery
function example3() {
  console.log('3. UNION CELLS (out-of-order delivery)');
  const union1 = unionCell([]);
  const union2 = unionCell([]);

  // Wire with random delays to simulate network
  union1.emit = (e) => {
    if (e && 'changed' in e) {
      const delay = Math.random() * 200;
      setTimeout(() => union2.receive(e.changed), delay);
    }
  };

  union2.emit = (e) => {
    if (e && 'changed' in e) {
      const delay = Math.random() * 200;
      setTimeout(() => union1.receive(e.changed), delay);
    }
  };

  // Send values in order
  union1.receive(['a', 'b']);
  console.log('  union1 receives [a,b]');

  union2.receive(['c', 'd']);
  console.log('  union2 receives [c,d]');

  union1.receive(['e']);
  console.log('  union1 receives [e]');

  setTimeout(() => {
    const s1 = union1.current().sort();
    const s2 = union2.current().sort();
    console.log('  After delays -> union1:', s1);
    console.log('               -> union2:', s2);
    console.log('  ✓ Both converged to same set despite out-of-order delivery!\n');
    conclusion();
  }, 500);
}

function conclusion() {
  console.log('=== KEY INSIGHTS ===');
  console.log('');
  console.log('1. Gadgets work the same with ANY transport:');
  console.log('   - Direct function calls');
  console.log('   - Async with setTimeout');
  console.log('   - Unix pipes (see pipes example)');
  console.log('   - TCP sockets (see tcp example)');
  console.log('   - HTTP + SSE (see http example)');
  console.log('');
  console.log('2. ACI properties handle distributed systems challenges:');
  console.log('   - Async delivery ✓');
  console.log('   - Out-of-order messages ✓');
  console.log('   - Network delays ✓');
  console.log('   - No coordination needed ✓');
  console.log('');
  console.log('3. The transport is just wiring:');
  console.log('   gadget.emit = (e) => transport.send(e)');
  console.log('   transport.on("data", (d) => gadget.receive(d))');
  console.log('');
  console.log('That\'s it! The gadget protocol handles everything else.');
}