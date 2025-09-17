#!/usr/bin/env tsx
/**
 * TCP client with unionCell gadget
 * Connects to server and converges to same set
 */

import { createConnection } from 'net';
import { unionCell } from '../../../src/patterns/cells/array-set';
import * as readline from 'readline';

// Get client ID from command line or generate
const CLIENT_ID = process.argv[2] || `client-${Math.floor(Math.random() * 1000)}`;

// Create a unionCell that accumulates unique values (using arrays)
const union = unionCell([]);

// Connect to server
const PORT = 3000;
const socket = createConnection(PORT, 'localhost', () => {
  console.log(`[${CLIENT_ID}] Connected to server`);
});

// Wire gadget.emit to socket
union.emit = (effect) => {
  if (effect && 'changed' in effect && !socket.destroyed) {
    socket.write(JSON.stringify(effect) + '\n');
    console.log(`[${CLIENT_ID}] Sent to server:`, effect);
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
      console.log(`[${CLIENT_ID}] Received from server:`, data);
      union.receive(data.changed);
      console.log(`[${CLIENT_ID}] Current union:`, union.current());
    }
  } catch (e) {
    console.error(`[${CLIENT_ID}] Failed to parse:`, line);
  }
});

socket.on('error', (err) => {
  console.error(`[${CLIENT_ID}] Connection error:`, err.message);
});

socket.on('close', () => {
  console.log(`[${CLIENT_ID}] Disconnected from server`);
  console.log(`[${CLIENT_ID}] Final union:`, union.current());
  process.exit(0);
});

// Client generates some unique values
setTimeout(() => union.receive([`${CLIENT_ID}-1`, `${CLIENT_ID}-2`]), 200);
setTimeout(() => union.receive([`${CLIENT_ID}-3`]), 1000);
setTimeout(() => union.receive([`${CLIENT_ID}-4`, 'shared-value']), 1800);

// Auto disconnect after 3 seconds
setTimeout(() => {
  socket.end();
}, 3000);