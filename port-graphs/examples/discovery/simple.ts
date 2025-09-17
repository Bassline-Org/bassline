#!/usr/bin/env tsx
/**
 * Simple synchronous discovery example
 */

import { maxCell } from '../../src/patterns/cells/numeric';
import { unionCell } from '../../src/patterns/cells/array-set';
import { registry } from '../../src/patterns/discovery/registry';

console.log('=== Simple Discovery Demo ===\n');

// Create a registry
const reg = registry({});

// Monitor registry effects
reg.emit = (effect) => {
  if (effect?.changed?.registered) {
    console.log('  [Registry] Registered:', effect.changed.registered.name);
  }
  if (effect?.changed?.found) {
    console.log('  [Registry] Found:', effect.changed.found.name);
  }
  if (effect?.changed?.notFound) {
    console.log('  [Registry] Not found:', effect.changed.notFound);
  }
};

// Create some gadgets
const temp = maxCell(0);
const humidity = maxCell(0);
const agg = unionCell([]);

console.log('1. REGISTERING GADGETS');

// Register gadgets
reg.receive({
  name: 'temp-sensor',
  endpoint: temp,
  metadata: { type: 'sensor' }
});

reg.receive({
  name: 'humidity-sensor',
  endpoint: humidity,
  metadata: { type: 'sensor' }
});

reg.receive({
  name: 'aggregator',
  endpoint: agg,
  metadata: { type: 'aggregator' }
});

console.log('\n2. QUERYING REGISTRY');

// Query for gadgets
reg.receive({ lookup: 'temp-sensor' });
reg.receive({ lookup: 'aggregator' });
reg.receive({ lookup: 'non-existent' });

console.log('\n3. REGISTRY STATE');
const state = reg.current();
console.log('  Registered gadgets:', Object.keys(state));

console.log('\n4. DYNAMIC WIRING');

// Get gadgets from registry and wire them
const tempGadget = state['temp-sensor']?.endpoint;
const aggGadget = state['aggregator']?.endpoint;

if (tempGadget && aggGadget) {
  // Wire temp sensor to aggregator
  tempGadget.emit = (effect: any) => {
    if (effect?.changed) {
      aggGadget.receive([`temp:${effect.changed}`]);
      console.log(`  Temp → Aggregator: ${effect.changed}`);
    }
  };

  humidity.emit = (effect: any) => {
    if (effect?.changed) {
      aggGadget.receive([`humidity:${effect.changed}`]);
      console.log(`  Humidity → Aggregator: ${effect.changed}`);
    }
  };

  console.log('  Wired sensors to aggregator');
}

console.log('\n5. SENDING DATA');

tempGadget.receive(25);
humidity.receive(60);
tempGadget.receive(26);
humidity.receive(65);

console.log('\n6. FINAL STATE');
console.log('  Temp max:', tempGadget.current());
console.log('  Humidity max:', humidity.current());
console.log('  Aggregator union:', aggGadget.current());

console.log('\n=== Key Points ===');
console.log('• Registry is just a gadget that stores name→gadget mappings');
console.log('• Gadgets can be looked up by name at runtime');
console.log('• Wiring happens dynamically based on lookups');
console.log('• No compile-time dependencies between gadgets');