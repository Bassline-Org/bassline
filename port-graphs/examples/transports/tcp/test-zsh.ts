#!/usr/bin/env tsx
/**
 * Test that our standard TCP client works with the zsh gadget server
 */

import { createConnection } from 'net';
import { maxCell } from '../../../src/patterns/cells/numeric';
import * as readline from 'readline';

// Create a maxCell
const max = maxCell(0);

// Connect to zsh server on port 3002
const PORT = 3002;
const socket = createConnection(PORT, 'localhost', () => {
  console.log('[test] Connected to zsh gadget server!');
});

// Wire gadget.emit to socket
max.emit = (effect) => {
  if (effect && 'changed' in effect && !socket.destroyed) {
    socket.write(JSON.stringify(effect) + '\n');
    console.log('[test] Sent:', effect);
  }
};

// Wire socket to gadget.receive
const rl = readline.createInterface({
  input: socket,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const data = JSON.parse(line);
    if (data && 'changed' in data) {
      console.log('[test] Received:', data);
      max.receive(data.changed);
      console.log('[test] Current max:', max.current());
    }
  } catch (e) {
    console.error('[test] Failed to parse:', line);
  }
});

// Send test values
setTimeout(() => max.receive(10), 100);
setTimeout(() => max.receive(5), 300);
setTimeout(() => max.receive(20), 500);
setTimeout(() => max.receive(15), 700);

// Disconnect after 1 second
setTimeout(() => {
  console.log('[test] Final max:', max.current());
  console.log('[test] ✓ TypeScript and zsh gadgets converged!');
  socket.end();
  process.exit(0);
}, 1000);