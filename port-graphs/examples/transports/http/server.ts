#!/usr/bin/env tsx
/**
 * HTTP server exposing gadget through REST API
 * POST /receive - Send data to gadget
 * GET /current - Get current state
 * GET /events - Server-sent events stream
 */

import { createServer } from 'http';
import { maxCell } from '../../../src/patterns/cells/numeric';

// Create a maxCell
const max = maxCell(0);

// Track SSE connections
const sseClients = new Set<{ res: any }>();

// Wire gadget.emit to SSE broadcast
max.emit = (effect) => {
  if (effect && 'changed' in effect) {
    const message = `data: ${JSON.stringify(effect)}\n\n`;
    sseClients.forEach(client => {
      client.res.write(message);
    });
    console.log('[server] Broadcast to', sseClients.size, 'SSE clients:', effect);
  }
};

// Create HTTP server
const server = createServer((req, res) => {
  const { method, url } = req;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (method === 'POST' && url === '/receive') {
    // Receive data into gadget
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('[server] Received via HTTP:', data);
        max.receive(data.value);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          current: max.current()
        }));
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  } else if (method === 'GET' && url === '/current') {
    // Return current state
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      current: max.current()
    }));
  } else if (method === 'GET' && url === '/events') {
    // Server-sent events for real-time updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send current state immediately
    res.write(`data: ${JSON.stringify({ changed: max.current() })}\n\n`);

    // Add to SSE clients
    const client = { res };
    sseClients.add(client);
    console.log('[server] SSE client connected, total:', sseClients.size);

    // Remove on disconnect
    req.on('close', () => {
      sseClients.delete(client);
      console.log('[server] SSE client disconnected, remaining:', sseClients.size);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`[server] HTTP server listening on port ${PORT}`);
  console.log('[server] Endpoints:');
  console.log(`  POST http://localhost:${PORT}/receive - Send value to gadget`);
  console.log(`  GET  http://localhost:${PORT}/current - Get current max`);
  console.log(`  GET  http://localhost:${PORT}/events  - SSE stream`);
  console.log('[server] Starting max:', max.current());
});

// Server generates some values
setTimeout(() => max.receive(10), 1000);
setTimeout(() => max.receive(5), 2000);
setTimeout(() => max.receive(20), 3000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[server] Final max:', max.current());
  server.close();
  process.exit(0);
});