#!/usr/bin/env tsx
/**
 * HTTP client with maxCell gadget
 * Sends values via POST, receives updates via SSE
 */

import { maxCell } from '../../../src/patterns/cells/numeric';
import fetch from 'node-fetch';
import EventSource from 'eventsource';

// Get client ID from command line
const CLIENT_ID = process.argv[2] || `client-${Math.floor(Math.random() * 1000)}`;

// Create a maxCell
const max = maxCell(0);

const SERVER_URL = 'http://localhost:3001';

// Wire gadget.emit to HTTP POST
max.emit = async (effect) => {
  if (effect && 'changed' in effect) {
    try {
      const response = await fetch(`${SERVER_URL}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: effect.changed })
      });
      const result = await response.json();
      console.log(`[${CLIENT_ID}] Sent to server:`, effect, 'Response:', result);
    } catch (e) {
      console.error(`[${CLIENT_ID}] Failed to send:`, e.message);
    }
  }
};

// Connect to SSE for receiving updates
const eventSource = new EventSource(`${SERVER_URL}/events`);

eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data && 'changed' in data) {
      console.log(`[${CLIENT_ID}] Received from server:`, data);
      max.receive(data.changed);
      console.log(`[${CLIENT_ID}] Current max:`, max.current());
    }
  } catch (e) {
    console.error(`[${CLIENT_ID}] Failed to parse SSE:`, e.message);
  }
};

eventSource.onerror = (err) => {
  console.error(`[${CLIENT_ID}] SSE error:`, err);
};

console.log(`[${CLIENT_ID}] Connected to server via SSE`);
console.log(`[${CLIENT_ID}] Starting max:`, max.current());

// Client generates some values
setTimeout(() => max.receive(Math.floor(Math.random() * 50)), 500);
setTimeout(() => max.receive(Math.floor(Math.random() * 50)), 1500);
setTimeout(() => max.receive(Math.floor(Math.random() * 50)), 2500);

// Auto disconnect after 4 seconds
setTimeout(() => {
  eventSource.close();
  console.log(`[${CLIENT_ID}] Final max:`, max.current());
  process.exit(0);
}, 4000);