/**
 * Liveness Demo - Interactive CSP Editing
 *
 * Demonstrates how to work with live CSP networks:
 * 1. Forward compilation: CSP commands → Network updates
 * 2. State extraction: Network → Structured data
 * 3. Manual sync: Network effects → CSP awareness
 */

import { createLiveCSP } from './liveness';
import { intersectionProto } from '../../cells';
import { withTaps, quick } from '../../../core/context';

console.log('\n=== Liveness Demo: Interactive CSP Editing ===\n');

// Create a live CSP system
const liveCSP = createLiveCSP();

console.log('1. Define color type with domain {R, G, B}');
const colorFactory = () => withTaps(quick(intersectionProto<string>(), new Set(['R', 'G', 'B'])));
liveCSP.receive({ variable: { name: 'color', domain: colorFactory } });

console.log('2. Create three variables: australia, tasmania, victoria');
liveCSP.receive({ create: { id: 'australia', type: 'color' } });
liveCSP.receive({ create: { id: 'tasmania', type: 'color' } });
liveCSP.receive({ create: { id: 'victoria', type: 'color' } });

console.log('\n3. Extract current state:');
let state = liveCSP.extractState();
console.log(`   Types: ${state.types.map(t => t.name).join(', ')}`);
console.log(`   Variables: ${state.variables.map(v => v.id).join(', ')}`);
state.variables.forEach(v => {
  console.log(`     ${v.id}: ${JSON.stringify(Array.from(v.domain as Set<string>))}`);
});

console.log('\n4. Add constraint: australia ≠ tasmania');
const notEqual = <T>(d1: Set<T>, d2: Set<T>): [Set<T>, Set<T>] => {
  if (d1.size === 1 && d2.has(Array.from(d1)[0])) {
    const val = Array.from(d1)[0];
    return [d1, new Set([...d2].filter(v => v !== val))];
  }
  if (d2.size === 1 && d1.has(Array.from(d2)[0])) {
    const val = Array.from(d2)[0];
    return [new Set([...d1].filter(v => v !== val)), d2];
  }
  return [d1, d2];
};

liveCSP.receive({
  relate: {
    vars: ['australia', 'tasmania'],
    constraint: (d1: unknown, d2: unknown) => {
      const [r1, r2] = notEqual(d1 as Set<string>, d2 as Set<string>);
      return [r1, r2];
    }
  }
});

console.log('\n5. Refine australia to {R}');
const instances = liveCSP.network.current().spawning.current().instances.current();
instances.get('australia')?.receive(new Set(['R']));

console.log('   Constraint propagates: tasmania refined to {G, B}');
state = liveCSP.extractState();
const tasmaniaState = state.variables.find(v => v.id === 'tasmania');
console.log(`   tasmania: ${JSON.stringify(Array.from(tasmaniaState?.domain as Set<string>))}`);

console.log('\n6. Add another constraint: tasmania ≠ victoria');
liveCSP.receive({
  relate: {
    vars: ['tasmania', 'victoria'],
    constraint: (d1: unknown, d2: unknown) => {
      const [r1, r2] = notEqual(d1 as Set<string>, d2 as Set<string>);
      return [r1, r2];
    }
  }
});

console.log('\n7. Refine tasmania to {G}');
instances.get('tasmania')?.receive(new Set(['G']));

console.log('   Constraint propagates: victoria refined to {R, B}');
state = liveCSP.extractState();
const victoriaState = state.variables.find(v => v.id === 'victoria');
console.log(`   victoria: ${JSON.stringify(Array.from(victoriaState?.domain as Set<string>))}`);

console.log('\n8. Final state of all variables:');
state = liveCSP.extractState();
state.variables.forEach(v => {
  const domain = Array.from(v.domain as Set<string>);
  console.log(`   ${v.id}: ${JSON.stringify(domain)}`);
});

console.log('\n9. Demonstrate manual sync: Modify network directly');
console.log('   Creating new variable "newZealand" at network level...');

// Modify network directly (bypass CSP)
liveCSP.network.receive({ spawn: { id: 'newZealand', type: 'color' } });

console.log('   Before sync: CSP doesn\'t know about it');
state = liveCSP.extractState();
console.log(`   Variables count: ${state.variables.length}`);

console.log('   Manually sync network effect...');
liveCSP.syncFromNetwork({ spawned: { id: 'newZealand' } });

console.log('   After sync: CSP knows about it');
state = liveCSP.extractState();
console.log(`   Variables count: ${state.variables.length}`);
const newZealandState = state.variables.find(v => v.id === 'newZealand');
console.log(`   newZealand: ${JSON.stringify(Array.from(newZealandState?.domain as Set<string>))}`);

console.log('\n10. Demonstrate idempotence (ACI property)');
console.log('    Sending same refinement multiple times...');
const beforeDomain = instances.get('victoria')?.current();
console.log(`    victoria before: ${JSON.stringify(Array.from(beforeDomain as Set<string>))}`);

instances.get('victoria')?.receive(new Set(['R', 'B'])); // Same as current
instances.get('victoria')?.receive(new Set(['R', 'B'])); // Again
instances.get('victoria')?.receive(new Set(['R', 'B'])); // And again

const afterDomain = instances.get('victoria')?.current();
console.log(`    victoria after: ${JSON.stringify(Array.from(afterDomain as Set<string>))}`);
console.log(`    Domain unchanged (idempotent): ${JSON.stringify(beforeDomain) === JSON.stringify(afterDomain)}`);

console.log('\n11. Demonstrate monotonic refinement (always shrinks)');
console.log('    Refining victoria from {R, B} → {R}...');
instances.get('victoria')?.receive(new Set(['R']));

const refined = instances.get('victoria')?.current();
console.log(`    victoria: ${JSON.stringify(Array.from(refined as Set<string>))}`);

console.log('    Trying to expand back to {R, B} (intersection prevents)...');
instances.get('victoria')?.receive(new Set(['R', 'B']));

const stillRefined = instances.get('victoria')?.current();
console.log(`    victoria: ${JSON.stringify(Array.from(stillRefined as Set<string>))}`);
console.log(`    Domain stayed refined: {R} ∩ {R,B} = {R}`);

console.log('\n=== Demo Complete ===\n');

console.log('Key Takeaways:');
console.log('• Forward: CSP commands automatically update network');
console.log('• Extract: Can always query current network state');
console.log('• Manual sync: When modifying network directly, can sync back to CSP');
console.log('• ACI properties: Idempotent, Associative, Commutative');
console.log('• Monotonic: Domains only refine (shrink), never expand');
console.log('• Constraint propagation: Changes propagate automatically via taps');
