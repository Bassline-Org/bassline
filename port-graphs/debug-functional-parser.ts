#!/usr/bin/env tsx
/**
 * Debug the functional parser implementation
 */

import { createChoreographyParser } from './src/compilation/gadgets/parser-functional';

console.log('Testing functional parser...');

// Create parser
const parser = createChoreographyParser();

// Hook up to see what effects are emitted
let effects: any[] = [];

const originalEmit = parser.emit.bind(parser);
parser.emit = (effect: any) => {
  console.log('Parser emitted effect:', effect);
  effects.push(effect);
  originalEmit(effect);
};

// Test simple input
const testChoreography = `
name: test
roles:
  api:
    type: coordinator
  worker:
    type: worker
relationships:
  api -> worker: request
`;

console.log('Sending choreography to functional parser...');
parser.receive({
  source: testChoreography,
  path: 'test.yaml',
  format: 'yaml'
});

console.log('\nParser state after processing:', parser.current());
console.log('\nEffects emitted:', effects.length);
effects.forEach((effect, i) => {
  console.log(`Effect ${i + 1}:`, effect);
});