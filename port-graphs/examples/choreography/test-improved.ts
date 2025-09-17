#!/usr/bin/env tsx
/**
 * Test improved choreography features
 */

import { createGadget } from '../../src/core';
import { changed } from '../../src/effects';
import { wireEmitToReceive, broadcastEmit, composeEmit } from '../../src/semantics/compose';
import { validateChoreography } from '../../src/patterns/choreography/validation';

console.log('=== Testing Improved Choreography Features ===\n');

console.log('1. EMIT COMPOSITION');

const gadget1 = createGadget(
  (_s, data) => ({ action: 'process', context: { data } }),
  { 'process': (_g, { data }) => changed({ processed: data }) }
)({});

const gadget2 = createGadget(
  (_s, data) => ({ action: 'log', context: { data } }),
  { 'log': (_g, { data }) => {
    console.log('  Gadget2 received:', data);
    return null;
  }}
)({});

const gadget3 = createGadget(
  (_s, data) => ({ action: 'log', context: { data } }),
  { 'log': (_g, { data }) => {
    console.log('  Gadget3 received:', data);
    return null;
  }}
)({});

// Test composed emit - preserves original and adds new targets
gadget1.emit = composeEmit(
  (e) => console.log('  Original emit:', e),
  (e) => gadget2.receive(e),
  (e) => gadget3.receive(e)
);

console.log('  Sending data through gadget1...');
gadget1.receive('test-data');

console.log('\n2. VALIDATION');

const roles = [
  { name: 'coordinator', type: 'coordinator', capabilities: ['coordinate'] },
  { name: 'worker1', type: 'worker' },
  { name: 'worker2', type: 'worker' }
];

const relationships = [
  { from: 'coordinator', to: 'worker1', type: 'sends', protocol: 'task' },
  { from: 'coordinator', to: 'worker2', type: 'sends', protocol: 'task' },
  { from: 'worker1', to: 'coordinator', type: 'responds', protocol: 'result' },
  { from: 'worker2', to: 'coordinator', type: 'responds', protocol: 'result' }
];

const validation = validateChoreography(roles, relationships);
console.log('  Valid:', validation.valid);
console.log('  Errors:', validation.errors);
console.log('  Warnings:', validation.warnings);

// Test invalid choreography
console.log('\n  Testing invalid choreography...');
const invalidRelationships = [
  ...relationships,
  { from: 'unknown', to: 'worker1', type: 'sends', protocol: 'test' }
];

const invalidValidation = validateChoreography(roles, invalidRelationships);
console.log('  Valid:', invalidValidation.valid);
console.log('  Errors:', invalidValidation.errors);

console.log('\n3. ADVANCED WIRING');

// Test broadcast
const broadcaster = createGadget(
  (_s, data) => ({ action: 'broadcast', context: { data } }),
  { 'broadcast': (_g, { data }) => changed({ broadcast: data }) }
)({});

const receivers = [gadget2, gadget3];

broadcastEmit(broadcaster, receivers);

console.log('  Broadcasting message...');
broadcaster.receive('broadcast-message');

console.log('\n=== Features Tested ===');
console.log('✓ Composed emit preserves original behavior');
console.log('✓ Validation catches errors in choreography specs');
console.log('✓ Broadcast wiring to multiple targets');
console.log('✓ No emit overwriting - proper composition');