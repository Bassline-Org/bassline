#!/usr/bin/env tsx
/**
 * TCP server with unionCell gadget
 * Shows multiple clients converging to same set
 */

import { createServer, Socket } from 'net';
import { arrayUnionCell } from '../../../src/patterns/cells';
import * as readline from 'readline';

// Create a unionCell that accumulates unique values (using arrays)
const union = arrayUnionCell([]);

// Track connected clients
const clients = new Set<Socket>();

// Wire gadget.emit to broadcast to all clients
union.emit = (effect) => {
  if (effect && 'changed' in effect) {
    const message = JSON.stringify(effect) + '\n';
    clients.forEach(client => {
      if (!client.destroyed) {
        client.write(message);
      }
    });
    console.log('[server] Broadcast to', clients.size, 'clients:', effect);
  }
};

// Create TCP server
const server = createServer((socket) => {
  console.log('[server] Client connected from:', socket.remoteAddress);
  clients.add(socket);

  // Send current state to new client
  socket.write(JSON.stringify({ changed: union.current() }) + '\n');

  // Wire socket to gadget.receive
  const rl = readline.createInterface({
    input: socket,
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    try {
      const data = JSON.parse(line);
      if (data && 'changed' in data) {
        console.log('[server] Received from client:', data);
        union.receive(data.changed);
        console.log('[server] Current union:', union.current());
      }
    } catch (e) {
      console.error('[server] Failed to parse:', line);
    }
  });

  socket.on('close', () => {
    console.log('[server] Client disconnected');
    clients.delete(socket);
  });

  socket.on('error', (err) => {
    console.error('[server] Socket error:', err.message);
    clients.delete(socket);
  });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[server] TCP server listening on port ${PORT}`);
  console.log('[server] Starting union:', union.current());
});

// Server generates some values
setTimeout(() => union.receive(['server-1', 'server-2']), 500);
setTimeout(() => union.receive(['server-3']), 1500);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[server] Final union:', union.current());
  server.close();
  process.exit(0);
});