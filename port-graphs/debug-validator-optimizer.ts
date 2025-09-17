#!/usr/bin/env tsx
/**
 * Debug validator → optimizer flow
 */

import { createChoreographyParser } from './src/compilation/gadgets/parser-functional';
import { createSemanticValidator } from './src/compilation/gadgets/validator-functional';
import { createChoreographyOptimizer } from './src/compilation/gadgets/optimizer-functional';

console.log('Testing validator → optimizer flow...');

// Create gadgets
const parser = createChoreographyParser();
const validator = createSemanticValidator();
const optimizer = createChoreographyOptimizer({ level: 'basic' });

// Hook up effects
let validatorEffects: any[] = [];
let optimizerEffects: any[] = [];

const originalValidatorEmit = validator.emit.bind(validator);
validator.emit = (effect: any) => {
  console.log('Validator emitted:', effect);
  validatorEffects.push(effect);
  originalValidatorEmit(effect);

  // Forward to optimizer
  optimizer.receive(effect);
};

const originalOptimizerEmit = optimizer.emit.bind(optimizer);
optimizer.emit = (effect: any) => {
  console.log('Optimizer emitted:', effect);
  optimizerEffects.push(effect);
  originalOptimizerEmit(effect);
};

// Parse → validate → optimize
const testChoreography = `
name: test
roles:
  api:
    type: coordinator
relationships:
  api -> api: self_test
`;

// Parse
parser.emit = (effect: any) => {
  console.log('Parser emitted:', effect);
  // Forward to validator
  validator.receive(effect);
};

parser.receive({
  source: testChoreography,
  path: 'test.yaml',
  format: 'yaml'
});

console.log('\nFinal states:');
console.log('Validator state:', validator.current());
console.log('Optimizer state:', optimizer.current());

console.log('\nValidator effects:', validatorEffects.length);
console.log('Optimizer effects:', optimizerEffects.length);