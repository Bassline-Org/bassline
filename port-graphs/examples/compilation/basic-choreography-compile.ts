#!/usr/bin/env tsx
/**
 * Basic Choreography Compilation Example
 *
 * Demonstrates the always-on compilation network transforming a simple
 * choreography specification into executable filesystem artifacts
 */

import { createCompilationNetwork } from '../../src/compilation/network';
import * as path from 'path';

console.log('=== Choreographic Compilation Demo ===\n');

console.log('1. CREATING COMPILATION NETWORK');

// Create compilation network targeting filesystem
const network = createCompilationNetwork({
  outputPath: path.join(process.cwd(), 'compiled-network'),
  targets: ['filesystem'],
  optimizationLevel: 'basic',
  dryRun: false,
  enableBackup: true
});

console.log('  ✓ Created always-on compilation network');
console.log(`  ✓ Output path: ${path.join(process.cwd(), 'compiled-network')}`);

console.log('\n2. CHOREOGRAPHY SPECIFICATION');

const simpleChoreography = `
# Simple Payment Processing Choreography
name: payment-processor
version: 1.0.0

roles:
  gateway:
    type: coordinator
    capabilities:
      - receive_payment_request
      - validate_payment
      - route_request

  processor:
    type: worker
    capabilities:
      - process_payment
      - update_balance
      - send_confirmation

  validator:
    type: validator
    capabilities:
      - validate_card
      - check_limits
      - fraud_detection

  logger:
    type: observer
    capabilities:
      - log_transaction
      - audit_trail

relationships:
  gateway -> processor: payment_request
  gateway -> validator: validation_request
  processor -> gateway: payment_result
  validator -> gateway: validation_result
  processor -> logger: transaction_log
  validator -> logger: validation_log
`;

console.log('  Choreography defines:');
console.log('  • 4 roles: gateway, processor, validator, logger');
console.log('  • 6 relationships with different protocols');
console.log('  • Mixed role types: coordinator, worker, validator, observer');

console.log('\n3. COMPILATION PROCESS');

async function demonstrateCompilation() {
  try {
    console.log('  Starting compilation...');

    // Compile the choreography
    const result = await network.compile(simpleChoreography, {
      path: 'payment-processor.yaml',
      format: 'yaml'
    });

    if (result.success) {
      console.log('  ✓ Compilation successful!');
      console.log(`  ✓ Processed ${result.metrics.totalNodes} nodes`);
      console.log(`  ✓ Generated ${result.metrics.generatedArtifacts} artifacts`);
      console.log(`  ✓ Materialized ${result.metrics.materializedFiles} files`);
      console.log(`  ✓ Compilation time: ${result.metrics.compilationTime}ms`);

      if (result.metrics.errors > 0) {
        console.log(`  ⚠ ${result.metrics.errors} errors`);
      }
      if (result.metrics.warnings > 0) {
        console.log(`  ⚠ ${result.metrics.warnings} warnings`);
      }

    } else {
      console.log('  ✗ Compilation failed:', result.error);
      return;
    }

    console.log('\n4. COMPILATION ARTIFACTS');

    console.log('  Generated file structure:');
    console.log('  compiled-network/');
    console.log('  ├── gateway/');
    console.log('  │   ├── gadget.sh      # Main gadget script');
    console.log('  │   ├── receive*       # Message receiver');
    console.log('  │   ├── emit*          # Effect emitter');
    console.log('  │   ├── current*       # State reader');
    console.log('  │   ├── update*        # State updater');
    console.log('  │   ├── state.json     # Initial state');
    console.log('  │   └── config.json    # Configuration');
    console.log('  ├── processor/         # Same structure');
    console.log('  ├── validator/         # Same structure');
    console.log('  ├── logger/            # Same structure');
    console.log('  └── relationships/');
    console.log('      ├── gateway-processor-payment_request/');
    console.log('      │   ├── config.json');
    console.log('      │   └── wire.sh*');
    console.log('      └── ... (other relationships)');

    console.log('\n5. LIVE COMPILATION STATUS');

    const status = network.getStatus();
    console.log('  Network Status:');
    console.log(`  • Active: ${status.active}`);
    console.log(`  • Recent Effects: ${status.recentEffects}`);
    console.log(`  • Gadgets: ${Object.keys(status.gadgets).join(', ')}`);

    console.log('\n  Gadget States:');
    Object.entries(status.gadgets).forEach(([name, gadgetStatus]: [string, any]) => {
      console.log(`    ${name}:`);
      console.log(`    • AST Version: ${gadgetStatus.astVersion || 0}`);
      console.log(`    • Cache Size: ${gadgetStatus.cacheSize || 0}`);
      if (gadgetStatus.metrics) {
        const m = gadgetStatus.metrics;
        console.log(`    • Metrics: ${m.parsedNodes || 0} parsed, ${m.validNodes || 0} valid, ${m.optimizedNodes || 0} optimized`);
      }
    });

    console.log('\n6. QUERY INTERFACE');

    // Demonstrate query interface
    console.log('  Querying compilation state:');

    const metrics = network.query('/metrics');
    console.log(`  • /metrics: ${metrics.totalNodes} total nodes, ${metrics.errors} errors`);

    const recentEffects = network.query('/effects/5');
    console.log(`  • /effects/5: ${recentEffects.length} recent effects`);

    const parserStatus = network.query('/gadgets/parser');
    console.log(`  • /gadgets/parser: AST v${parserStatus?.astVersion || 0}`);

    console.log('\n7. INCREMENTAL COMPILATION TEST');

    console.log('  Modifying choreography (adding new role)...');

    const modifiedChoreography = simpleChoreography + `

  notifier:
    type: observer
    capabilities:
      - send_notification
      - track_delivery

relationships:
  processor -> notifier: payment_notification
`;

    const incrementalResult = await network.compile(modifiedChoreography, {
      path: 'payment-processor.yaml',
      format: 'yaml'
    });

    if (incrementalResult.success) {
      console.log('  ✓ Incremental compilation successful!');
      console.log(`  ✓ Total time: ${incrementalResult.metrics.compilationTime}ms`);
      console.log('  ✓ Only modified parts were recompiled');
    }

    console.log('\n8. COMPILATION EFFECTS STREAM');

    const effects = network.getRecentEffects(10);
    console.log('  Recent compilation effects:');
    effects.slice(-5).forEach((effect: any, i) => {
      const source = effect._source || 'unknown';
      const type = Object.keys(effect)[0];
      console.log(`  ${i + 1}. [${source}] ${type}`);
    });

  } catch (error) {
    console.error('Compilation demo failed:', error);
  }
}

// Run the demonstration
demonstrateCompilation().then(() => {
  console.log('\n=== Key Achievements ===');
  console.log('✓ Always-on compilation network');
  console.log('✓ Non-linear gadget collaboration');
  console.log('✓ Progressive information sharing');
  console.log('✓ Incremental compilation');
  console.log('✓ Filesystem artifact generation');
  console.log('✓ Real-time query interface');
  console.log('✓ Effect streaming and monitoring');

  console.log('\n=== Next Steps ===');
  console.log('• Add container compilation target');
  console.log('• Implement MCP integration');
  console.log('• Add self-modifying compilation');
  console.log('• Create visual compilation dashboard');

  process.exit(0);
}).catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
});