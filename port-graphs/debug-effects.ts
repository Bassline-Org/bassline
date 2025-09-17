#!/usr/bin/env tsx
/**
 * Debug effects flowing through the system
 */

import { createChoreographyParser } from './src/compilation/gadgets/parser';
import { createSemanticValidator } from './src/compilation/gadgets/validator';

console.log('Testing effect flow...');

// Create parser
const parser = createChoreographyParser();

// Create validator
const validator = createSemanticValidator();

// Hook up to see what effects are emitted
let parserEffects: any[] = [];
let validatorEffects: any[] = [];

const originalParserEmit = parser.emit.bind(parser);
parser.emit = (effect: any) => {
  console.log('Parser emitted:', effect);
  parserEffects.push(effect);
  originalParserEmit(effect);

  // Manually send to validator to test
  validator.receive(effect);
};

const originalValidatorEmit = validator.emit.bind(validator);
validator.emit = (effect: any) => {
  console.log('Validator emitted:', effect);
  validatorEffects.push(effect);
  originalValidatorEmit(effect);
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

console.log('Sending choreography to parser...');
parser.receive({
  source: testChoreography,
  path: 'test.yaml',
  format: 'yaml'
});

console.log('\nParser state after processing:', parser.current());
console.log('\nValidator state after processing:', validator.current());

console.log('\nParser effects:', parserEffects.length);
console.log('Validator effects:', validatorEffects.length);