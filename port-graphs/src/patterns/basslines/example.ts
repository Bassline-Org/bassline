/**
 * Before/After Example - Network Bassline Ergonomics
 *
 * Shows how basslines solve the ergonomics problem.
 */

import { withTaps, quick } from '../../core/context';
import { maxProto } from '../cells';
import { transformProto } from '../functions';
import { createNetworkBassline } from './network';

// ================================================
// BEFORE: Manual Network Management (Verbose & Imperative)
// ================================================

function createNetworkManually() {
  // Create gadgets manually with verbose wrapping
  const counter = withTaps(quick(maxProto, 0));
  const doubler = withTaps(quick(transformProto((x: number) => x * 2), undefined));
  const tripler = withTaps(quick(transformProto((x: number) => x * 3), undefined));

  // Manual wiring with cleanup tracking
  const cleanups: Array<() => void> = [];

  cleanups.push(
    counter.tap(({ changed }) => {
      if (changed !== undefined) doubler.receive(changed);
    })
  );

  cleanups.push(
    counter.tap(({ changed }) => {
      if (changed !== undefined) tripler.receive(changed);
    })
  );

  // Manual cleanup
  const destroy = () => {
    cleanups.forEach(c => c());
  };

  return { counter, doubler, tripler, destroy };
}

// ================================================
// AFTER: Declarative Network with Bassline
// ================================================

function createNetworkDeclaratively() {
  const network = createNetworkBassline();

  // Define vocabulary (what types exist)
  network.receive({
    define: {
      name: 'counter',
      factory: () => withTaps(quick(maxProto, 0))
    }
  });

  network.receive({
    define: {
      name: 'doubler',
      factory: () => withTaps(quick(transformProto((x: number) => x * 2), undefined))
    }
  });

  network.receive({
    define: {
      name: 'tripler',
      factory: () => withTaps(quick(transformProto((x: number) => x * 3), undefined))
    }
  });

  // Spawn instances
  network.receive({ spawn: { id: 'c1', type: 'counter' } });
  network.receive({ spawn: { id: 'd1', type: 'doubler' } });
  network.receive({ spawn: { id: 't1', type: 'tripler' } });

  // Wire them declaratively
  network.receive({ wire: { from: 'c1', to: 'd1' } });
  network.receive({ wire: { from: 'c1', to: 't1' } });

  // Get instances if needed
  const counter = network.current().instances.current().get('c1');
  const doubler = network.current().instances.current().get('d1');
  const tripler = network.current().instances.current().get('t1');

  // Cleanup handled by bassline
  const destroy = () => {
    network.receive({ destroy: 'c1' });
    network.receive({ destroy: 'd1' });
    network.receive({ destroy: 't1' });
  };

  return { counter, doubler, tripler, destroy };
}

// ================================================
// Comparison
// ================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Before/After Comparison');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('BEFORE (Manual):');
console.log('- 20+ lines of imperative code');
console.log('- Manual cleanup tracking');
console.log('- No reusability');
console.log('- No serialization');
console.log('- Hard to extend\n');

console.log('AFTER (Bassline):');
console.log('- 15 lines of declarative commands');
console.log('- Automatic cleanup');
console.log('- Reusable vocabulary');
console.log('- Can serialize definitions');
console.log('- Easy to extend');
console.log('- Enable/disable network');
console.log('- Error handling built-in\n');

// Run both
const manual = createNetworkManually();
const declarative = createNetworkDeclaratively();

console.log('Both networks work identically:');
manual.counter?.receive(5);
declarative.counter?.receive(5);

console.log(`Manual doubler: ${manual.doubler?.current()}`);
console.log(`Declarative doubler: ${declarative.doubler?.current()}`);

console.log(`Manual tripler: ${manual.tripler?.current()}`);
console.log(`Declarative tripler: ${declarative.tripler?.current()}`);

// Cleanup
manual.destroy();
declarative.destroy();
