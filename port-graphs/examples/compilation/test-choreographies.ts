#!/usr/bin/env npx tsx

/**
 * Test the new choreography format with various examples
 */

import { loadChoreography, saveChoreography } from '../../src/choreography/io';
import { buildNetwork } from '../../src/choreography/builder';
import { validateChoreography } from '../../src/choreography/io';
import * as path from 'path';

// Test loading and running choreographies
async function testChoreography(file: string) {
  console.log(`\n=== Testing ${path.basename(file)} ===`);

  try {
    // Load the choreography
    const choreography = loadChoreography(file);
    console.log(`✓ Loaded choreography with ${Object.keys(choreography.gadgets).length} gadgets`);

    // Validate structure
    if (!validateChoreography(choreography)) {
      throw new Error('Invalid choreography structure');
    }
    console.log('✓ Validated choreography structure');

    // Build the network
    const network = buildNetwork(choreography);
    console.log(`✓ Built network with gadgets: ${network.ids().join(', ')}`);

    // Test round-trip save/load
    const tempFile = file.replace(/\.(yaml|yml|json)$/, '.test.$1');
    saveChoreography(choreography, tempFile);
    const reloaded = loadChoreography(tempFile);

    if (JSON.stringify(choreography) === JSON.stringify(reloaded)) {
      console.log('✓ Round-trip save/load successful');
    } else {
      throw new Error('Round-trip save/load failed');
    }

    // Clean up temp file
    require('fs').unlinkSync(tempFile);

    console.log(`✓ ${path.basename(file)} test passed`);
    return true;

  } catch (error) {
    console.error(`✗ Failed: ${error}`);
    return false;
  }
}

// Run all tests
async function main() {
  console.log('Testing choreography system...');

  const choreographies = [
    './choreographies/max-accumulator.yaml',
    './choreographies/pubsub-network.json',
    './choreographies/computation-pipeline.yaml',
    './choreographies/router-example.yaml'
  ];

  const results = await Promise.all(
    choreographies.map(file => testChoreography(path.join(__dirname, file)))
  );

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`\n=== Summary ===`);
  console.log(`${passed}/${total} choreographies tested successfully`);

  if (passed === total) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);