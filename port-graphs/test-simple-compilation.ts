#!/usr/bin/env tsx
/**
 * Simple debug test for compilation system
 */

import { createCompilationNetwork } from './src/compilation/network';

console.log('Testing simple compilation...');

const network = createCompilationNetwork({
  outputPath: './test-output',
  targets: ['filesystem']
});

const simpleChoreography = `
name: test
roles:
  api:
    type: coordinator
  worker:
    type: worker
relationships:
  api -> worker: request
`;

console.log('Created network, starting compilation...');

async function test() {
  try {
    console.log('Network status before compilation:', network.getStatus());

    const result = await network.compile(simpleChoreography, { path: 'test.yaml' });

    console.log('Compilation result:', {
      success: result.success,
      error: result.error,
      metrics: result.metrics
    });

    console.log('Network status after compilation:', network.getStatus());
    console.log('Recent effects:', network.getRecentEffects(10));

  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();