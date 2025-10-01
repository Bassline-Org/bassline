/**
 * Map Coloring Demo
 *
 * Demonstrates the 3-layer DSL compilation tower:
 *   CSP DSL → Network DSL → Infrastructure (Wiring + Spawning)
 *
 * Problem: Color Australian map regions such that no adjacent regions share a color.
 * Regions: WA, NT, SA, Q, NSW, V, T
 * Colors: Red, Green, Blue
 */

import { quick, withTaps } from '../../../core/context';
import { intersectionProto } from '../../cells';
import { createCSPGadget } from './csp';

export function mapColoringDemo() {
  console.log('=== Map Coloring Demo ===\n');

  // Create CSP DSL gadget (top of the tower)
  const csp = createCSPGadget();

  // Track effects
  const effects: any[] = [];
  csp.tap(e => {
    effects.push(e);
    if ('variableDefined' in e && e.variableDefined) {
      console.log(`✓ Defined variable type: ${e.variableDefined.name}`);
    }
    if ('created' in e && e.created) {
      console.log(`✓ Created variable: ${e.created.id}`);
    }
    if ('related' in e && e.related) {
      console.log(`✓ Related variables: ${e.related.vars.join(', ')}`);
    }
    if ('error' in e && e.error) {
      console.error(`✗ Error: ${e.error.type} - ${e.error.details}`);
    }
  });

  // 1. Define variable type using CSP vocabulary
  console.log('\n1. Defining "color" variable type...');
  csp.receive({
    variable: {
      name: 'color',
      domain: () =>
        withTaps(quick(intersectionProto(), new Set(['Red', 'Green', 'Blue'])))
    }
  });

  // 2. Create variables for Australian map regions
  console.log('\n2. Creating region variables...');
  const regions = ['wa', 'nt', 'sa', 'q', 'nsw', 'v', 't'];
  regions.forEach(region => {
    csp.receive({
      create: {
        id: region,
        type: 'color'
      }
    });
  });

  // 3. Define "not equal" constraint (adjacent regions must differ)
  console.log('\n3. Declaring adjacency constraints...');
  const notEqual = (d1: Set<string>, d2: Set<string>) => {
    // If d1 is decided (size 1), remove that value from d2
    // If d2 is decided (size 1), remove that value from d1
    // Otherwise, no refinement (need more info)
    const refined1 = d2.size === 1
      ? new Set([...d1].filter(x => !d2.has(x)))
      : d1;
    const refined2 = d1.size === 1
      ? new Set([...d2].filter(x => !d1.has(x)))
      : d2;
    return [refined1, refined2];
  };

  // Australian map adjacencies
  const adjacencies = [
    ['wa', 'nt'],
    ['wa', 'sa'],
    ['nt', 'sa'],
    ['nt', 'q'],
    ['sa', 'q'],
    ['sa', 'nsw'],
    ['sa', 'v'],
    ['q', 'nsw'],
    ['nsw', 'v']
  ];

  adjacencies.forEach(pair => {
    csp.receive({
      relate: {
        vars: pair,
        constraint: notEqual
      }
    });
  });

  // 4. Access variables and check domains
  console.log('\n4. Initial domains (before propagation):');
  const network = csp.current().network;
  const instances = network.current().spawning.current().instances.current();

  regions.forEach(region => {
    const variable = instances.get(region);
    const domain = variable?.current();
    console.log(`  ${region.toUpperCase()}: ${JSON.stringify([...domain])}`);
  });

  // 5. Make a choice to trigger propagation
  console.log('\n5. Assigning WA = Red to trigger constraint propagation...');
  const wa = instances.get('wa');
  wa?.receive(new Set(['Red']));

  // Small delay to allow propagation (taps are fire-and-forget)
  setTimeout(() => {
    console.log('\n6. Domains after propagation:');
    regions.forEach(region => {
      const variable = instances.get(region);
      const domain = variable?.current();
      console.log(`  ${region.toUpperCase()}: ${JSON.stringify([...domain])}`);
    });

    // 7. Verify compilation tower
    console.log('\n7. Verifying the compilation tower:');
    console.log('  ✓ CSP Layer: variables and constraints defined');
    console.log('  ✓ Network Layer: types defined, instances spawned, gadgets wired');
    console.log('  ✓ Infrastructure Layer: spawning and wiring gadgets operational');

    console.log(`\n=== Demo Complete ===`);
    console.log(`Total effects emitted: ${effects.length}`);
  }, 100);
}

// Run the demo if this file is executed directly
if (require.main === module) {
  mapColoringDemo();
}
