#!/usr/bin/env tsx
/**
 * Test the CompilationNetwork class with functional gadgets
 */

import { createCompilationNetwork } from './src/compilation/network';

console.log('Testing CompilationNetwork class...\n');

// Create compilation network
const network = createCompilationNetwork({
  outputPath: './test-network-output',
  targets: ['filesystem'],
  dryRun: true,
  enableBackup: true
});

// Test choreography
const testChoreography = `
name: network-test
version: 1.0.0
description: Test choreography for network compilation
roles:
  frontend:
    type: coordinator
    capabilities: [receive, route, emit]
    deployment:
      target: container
      config:
        replicas: 2
  backend:
    type: processor
    capabilities: [process, compute, store]
  cache:
    type: observer
    capabilities: [observe, cache, emit]
relationships:
  frontend -> backend: http
  backend -> cache: pubsub
  frontend -> cache: websocket
`;

console.log('Input choreography:');
console.log(testChoreography);

// Compile
(async () => {
  console.log('\n--- Starting compilation ---\n');

  const result = await network.compile(testChoreography, {
    path: 'test.yaml',
    format: 'yaml'
  });

  console.log('\n--- Compilation Result ---');
  console.log('Success:', result.success);
  console.log('Metrics:', result.metrics);
  console.log('Artifacts generated:', result.artifacts.length);
  console.log('Effects produced:', result.effects.length);

  if (!result.success && result.error) {
    console.log('Error:', result.error);
  }

  // Query network status
  console.log('\n--- Network Status ---');
  const status = network.getStatus();
  console.log('Active:', status.active);
  console.log('Gadgets:', Object.keys(status.gadgets));
  console.log('Recent effects:', status.recentEffects);

  // Query specific gadget status
  console.log('\n--- Parser Status ---');
  const parserStatus = network.query('gadgets/parser');
  if (parserStatus) {
    console.log('Parsed nodes:', parserStatus.metrics?.parsedNodes || 0);
  }

  console.log('\n--- Validator Status ---');
  const validatorStatus = network.query('gadgets/validator');
  if (validatorStatus) {
    console.log('Valid nodes:', validatorStatus.metrics?.validNodes || 0);
    console.log('Errors:', validatorStatus.metrics?.errors || 0);
  }

  // Shutdown
  network.shutdown();
})();