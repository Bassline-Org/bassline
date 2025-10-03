/**
 * WebSocket Server Demo
 *
 * Demonstrates:
 * 1. Transport-agnostic gadgets (same gadget works everywhere)
 * 2. Protocol-generic adapters (works with any Valued<T> gadget)
 * 3. Real distributed sync with ACI convergence properties
 * 4. Server as thin transport layer (no business logic)
 *
 * Run with: npx tsx src/demo/websocket-server.ts
 * Then open multiple tabs at the client HTML file
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createSharedState } from './shared-state';
import { wsValuedAdapter, wsBroadcastAdapter } from '../patterns/network/adapters';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🌐 Distributed Gadget Sync Server');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ================================================
// Shared State (Transport-Agnostic Gadget)
// ================================================

// This is the ACTUAL source of truth - a pure gadget with zero transport knowledge
const sharedState = createSharedState();

console.log('✅ Created shared state gadget');
console.log(`   Protocol: Valued<Set<number>>`);
console.log(`   Initial state: ${Array.from(sharedState.current()).join(', ') || '(empty)'}\n`);

// ================================================
// Broadcast Setup (One Gadget → Many Clients)
// ================================================

const clients = new Set<WebSocket>();

// Wire sharedState to broadcast to all clients
// When sharedState emits { changed }, all clients receive it
wsBroadcastAdapter(sharedState, () => clients);

console.log('✅ Wired broadcast adapter');
console.log(`   Shared state effects → All connected clients\n`);

// ================================================
// WebSocket Server (Just Transport Layer)
// ================================================

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (socket, req) => {
  const clientId = Math.random().toString(36).substring(7);
  console.log(`🔌 Client connected: ${clientId}`);
  console.log(`   IP: ${req.socket.remoteAddress}`);

  clients.add(socket);
  console.log(`   Total clients: ${clients.size}\n`);

  // Wire this client to shared state (bidirectional)
  // Client messages → shared state → broadcast to all other clients
  wsValuedAdapter(socket, sharedState, {
    serialize: (set: Set<number>) => Array.from(set),
    deserialize: (arr: number[]) => new Set(arr)
  });

  // Send current state to new client immediately
  socket.send(JSON.stringify({
    changed: Array.from(sharedState.current())
  }));

  socket.on('close', () => {
    clients.delete(socket);
    console.log(`❌ Client disconnected: ${clientId}`);
    console.log(`   Remaining clients: ${clients.size}\n`);
  });

  socket.on('error', (err) => {
    console.error(`⚠️  Client error (${clientId}):`, err.message);
  });
});

wss.on('error', (err) => {
  console.error('Server error:', err);
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Server running on ws://localhost:8080');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📖 Open multiple browser tabs to see distributed sync!');
console.log('   All tabs will share the same Set<number> state');
console.log('   Updates from any tab instantly appear in all others');
console.log('\n⚡ ACI Properties:');
console.log('   - Order of updates doesn\'t matter (Commutative)');
console.log('   - Duplicate updates ignored (Idempotent)');
console.log('   - Concurrent updates merge correctly (Associative)');
console.log('\nPress Ctrl+C to stop\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  wss.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
