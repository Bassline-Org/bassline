#!/usr/bin/env tsx
/**
 * Basic discovery example - Gadgets finding each other by name
 */

import { maxCell } from '../../src/patterns/cells/numeric';
import { unionCell } from '../../src/patterns/cells/array-set';
import { createDiscoverySystem, registerGadget, resolveGadget } from '../../src/patterns/discovery';

async function main() {
  console.log('=== Gadget Discovery Demo ===\n');

  // Create discovery system
  const { registry, lookup } = createDiscoverySystem();

  // Create some gadgets
  const sensor1 = maxCell(0);
  const sensor2 = maxCell(0);
  const aggregator = unionCell([]);

  console.log('1. REGISTERING GADGETS');

  // Register gadgets with names
  registerGadget(registry, 'temperature-sensor', sensor1, {
    type: 'sensor',
    location: 'room-1',
    unit: 'celsius'
  });
  console.log('  Registered: temperature-sensor');

  registerGadget(registry, 'humidity-sensor', sensor2, {
    type: 'sensor',
    location: 'room-1',
    unit: 'percent'
  });
  console.log('  Registered: humidity-sensor');

  registerGadget(registry, 'data-aggregator', aggregator, {
    type: 'aggregator',
    accepts: ['sensor-data']
  });
  console.log('  Registered: data-aggregator\n');

  console.log('2. LOOKING UP GADGETS');

  // Look up gadgets by name
  const foundTemp = await resolveGadget(lookup, 'temperature-sensor');
  console.log('  Found temperature-sensor:', foundTemp ? '✓' : '✗');

  const foundAgg = await resolveGadget(lookup, 'data-aggregator');
  console.log('  Found data-aggregator:', foundAgg ? '✓' : '✗');

  const notFound = await resolveGadget(lookup, 'non-existent');
  console.log('  Found non-existent:', notFound ? '✓' : '✗\n');

  console.log('3. WIRING GADGETS DYNAMICALLY');

  // Wire sensors to aggregator using discovered references
  if (foundTemp && foundAgg) {
    foundTemp.emit = (effect) => {
      if (effect?.changed) {
        foundAgg.receive([`temp:${effect.changed}`]);
        console.log(`  Temperature → Aggregator: ${effect.changed}`);
      }
    };

    sensor2.emit = (effect) => {
      if (effect?.changed) {
        foundAgg.receive([`humidity:${effect.changed}`]);
        console.log(`  Humidity → Aggregator: ${effect.changed}`);
      }
    };

    console.log('  Wired temperature-sensor → data-aggregator');
    console.log('  Wired humidity-sensor → data-aggregator\n');
  }

  console.log('4. TESTING COMMUNICATION');

  // Send some data
  foundTemp!.receive(25);
  sensor2.receive(60);
  foundTemp!.receive(26);

  console.log('\n5. FINAL STATE');
  console.log('  Temperature sensor max:', foundTemp!.current());
  console.log('  Humidity sensor max:', sensor2.current());
  console.log('  Aggregator union:', foundAgg!.current());

  console.log('\n=== Key Insights ===');
  console.log('1. Gadgets register themselves with names');
  console.log('2. Other gadgets can look them up dynamically');
  console.log('3. Wiring happens at runtime based on discovery');
  console.log('4. No hard-coded references needed');
}

main().catch(console.error);