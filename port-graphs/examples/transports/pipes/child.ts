#!/usr/bin/env tsx
/**
 * Child process with maxCell gadget
 * Communicates with parent through stdin/stdout pipes
 */

import { maxCell } from '../../../src/patterns/cells/numeric';
import * as readline from 'readline';

// Create a maxCell that tracks maximum value
const max = maxCell(0);

// Wire gadget.emit to stdout
max.emit = (effect) => {
  if (effect && 'changed' in effect) {
    process.stdout.write(JSON.stringify(effect) + '\n');
    console.error('[child] Sent to parent:', effect);
  }
};

// Wire stdin to gadget.receive
const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    if (data && 'changed' in data) {
      console.error('[child] Received from parent:', data);
      max.receive(data.changed);
      console.error('[child] Current max:', max.current());
    }
  } catch (e) {
    console.error('[child] Failed to parse:', line);
  }
});

// Child also generates some values
console.error('[child] Starting with max:', max.current());

setTimeout(() => max.receive(7), 150);
setTimeout(() => max.receive(25), 250);
setTimeout(() => max.receive(3), 350);