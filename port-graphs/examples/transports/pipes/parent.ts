#!/usr/bin/env tsx
/**
 * Parent process with maxCell gadget
 * Communicates with child through stdin/stdout pipes
 */

import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { maxCell } from '../../../src/patterns/cells/numeric';
import * as readline from 'readline';

// Create a maxCell that tracks maximum value
const max = maxCell(0);

// Spawn child process
const child = spawn('tsx', [__dirname + '/child.ts'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Wire gadget.emit to child's stdin
max.emit = (effect) => {
  if (effect && 'changed' in effect) {
    child.stdin.write(JSON.stringify(effect) + '\n');
    console.log('[parent] Sent to child:', effect);
  }
};

// Wire child's stdout to gadget.receive
const rl = readline.createInterface({
  input: child.stdout,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    if (data && 'changed' in data) {
      console.log('[parent] Received from child:', data);
      max.receive(data.changed);
      console.log('[parent] Current max:', max.current());
    }
  } catch (e) {
    console.error('[parent] Failed to parse:', line);
  }
});

// Test: Send some values
console.log('[parent] Starting with max:', max.current());

setTimeout(() => max.receive(10), 100);
setTimeout(() => max.receive(5), 200);
setTimeout(() => max.receive(20), 300);
setTimeout(() => max.receive(15), 400);

// Cleanup
setTimeout(() => {
  console.log('[parent] Final max:', max.current());
  child.kill();
  process.exit(0);
}, 2000);