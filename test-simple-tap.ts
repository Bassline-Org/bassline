#!/usr/bin/env npx tsx

/**
 * Simple test of the tap-based system without React
 */

import { maxCell, lastCell, withTaps } from './port-graphs/src';
import { createGadget, changed } from './port-graphs/src';

console.log('Testing tap-based system...\n');

// Test basic tapping
const max = withTaps(maxCell(0));
const last = withTaps(lastCell(null));

// Connect max to last
const cleanup = max.tap((effect) => {
  console.log('Max emitted:', effect);
  if (effect && 'changed' in effect) {
    last.receive(effect.changed);
  }
});

console.log('Sending values to max...');
max.receive(10);
max.receive(5);  // Won't emit
max.receive(20);

console.log('Max current:', max.current());
console.log('Last current:', last.current());

// Cleanup
cleanup();
console.log('\nAfter cleanup:');
max.receive(30);
console.log('Max current:', max.current());
console.log('Last current:', last.current(), '(should still be 20)');

// Test pipeline
console.log('\n=== Pipeline Test ===');

const source = withTaps(createGadget(
  (_state, data: number) => ({ action: 'emit', context: data }),
  { emit: (gadget, data) => { gadget.update(data); return changed(data); } }
)(0));

const doubler = withTaps(createGadget(
  (_state, data: number) => ({ action: 'double', context: data }),
  { double: (gadget, data) => {
    const result = data * 2;
    gadget.update(result);
    return changed(result);
  }}
)(0));

const logger = withTaps(createGadget(
  (_state, data: any) => ({ action: 'log', context: data }),
  { log: (gadget, data) => {
    console.log('Final value:', data);
    gadget.update(data);
    return changed(data);
  }}
)(null));

// Wire the pipeline
source.tap((effect: any) => {
  if (effect && 'changed' in effect) {
    doubler.receive(effect.changed);
  }
});

doubler.tap((effect: any) => {
  if (effect && 'changed' in effect) {
    logger.receive(effect.changed);
  }
});

console.log('Sending through pipeline...');
source.receive(5);   // Should log 10
source.receive(10);  // Should log 20

console.log('\n✅ All tests completed!');