#!/usr/bin/env npx tsx

/**
 * Test the simplified gadget architecture
 */

import { maxCell, minCell } from '../src/patterns/cells/numeric';
import { withTaps } from '../src/semantics/tapping';
import { pipeline, broadcast, collect } from '../src/patterns/compound';
import { createGadget } from '../src/core';
import { changed } from '../src/effects';

console.log('Testing simplified gadget architecture...\n');

// Test 1: Basic tapping
console.log('=== Test 1: Basic Tapping ===');
const max = withTaps(maxCell(0));
const min = withTaps(minCell(100));

// Connect max to min
const cleanup = max.tap((effect) => {
  if (effect && 'changed' in effect) {
    console.log(`  Max emitted: ${effect.changed}`);
    min.receive(effect.changed);
  }
});

max.receive(10);
max.receive(5);  // Won't emit (not greater than 10)
max.receive(20);

console.log(`  Max current: ${max.current()}`);
console.log(`  Min current: ${min.current()}`);

// Cleanup the tap
cleanup();
max.receive(30); // Won't affect min
console.log(`  After cleanup - Max: ${max.current()}, Min: ${min.current()}\n`);

// Test 2: Pipeline
console.log('=== Test 2: Pipeline ===');

const doubler = createGadget<number, number>(
  (current, incoming) => ({ action: 'double', context: incoming }),
  {
    'double': (gadget, value) => {
      const result = value * 2;
      gadget.update(result);
      return changed(result);
    }
  }
)(1);

const adder = createGadget<number, number>(
  (current, incoming) => ({ action: 'add', context: incoming }),
  {
    'add': (gadget, value) => {
      const result = value + 10;
      gadget.update(result);
      return changed(result);
    }
  }
)(0);

const pipe = pipeline(doubler, adder, withTaps(maxCell(0)));

// Add tap to see final output
const pipeWithTap = withTaps(pipe);
pipeWithTap.tap((effect) => {
  if (effect && 'changed' in effect) {
    console.log(`  Pipeline output: ${effect.changed}`);
  }
});

pipe.receive(5);   // 5 * 2 + 10 = 20
pipe.receive(10);  // 10 * 2 + 10 = 30

// Test 3: Broadcast
console.log('\n=== Test 3: Broadcast ===');

const source = createGadget<string, string>(
  (_current, incoming) => ({ action: 'emit', context: incoming }),
  {
    'emit': (gadget, value) => {
      gadget.update(value);
      return changed(value);
    }
  }
)('');

const logger1 = createGadget<any[], any>(
  (_current, incoming) => ({ action: 'log', context: incoming }),
  {
    'log': (gadget, value) => {
      console.log(`  Logger1: ${value}`);
      const state = [...gadget.current(), value];
      gadget.update(state);
      return changed(state);
    }
  }
)([]);

const logger2 = createGadget<any[], any>(
  (_current, incoming) => ({ action: 'log', context: incoming }),
  {
    'log': (gadget, value) => {
      console.log(`  Logger2: ${value}`);
      const state = [...gadget.current(), value];
      gadget.update(state);
      return changed(state);
    }
  }
)([]);

const broadcaster = broadcast(source, [logger1, logger2]);
broadcaster.receive('Hello');
broadcaster.receive('World');

// Test 4: Collect
console.log('\n=== Test 4: Collect ===');

const temp = createGadget<number, number>(
  (_current, incoming) => ({ action: 'update', context: incoming }),
  {
    'update': (gadget, value) => {
      gadget.update(value);
      return changed(value);
    }
  }
)(0);

const humidity = createGadget<number, number>(
  (_current, incoming) => ({ action: 'update', context: incoming }),
  {
    'update': (gadget, value) => {
      gadget.update(value);
      return changed(value);
    }
  }
)(0);

const collector = withTaps(collect(
  [
    { id: 'temp', gadget: temp },
    { id: 'humidity', gadget: humidity }
  ],
  (values) => ({
    ...values,
    comfort: values.temp > 20 && values.humidity < 60 ? 'comfortable' : 'uncomfortable'
  })
));

collector.tap((effect) => {
  if (effect && 'result' in effect) {
    console.log('  Collected:', effect.result);
  }
});

temp.receive(22);
humidity.receive(50); // Should trigger collection

console.log('\n✓ All tests completed!');