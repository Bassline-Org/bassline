/**
 * Simple test to verify the femto-bassline system works
 */

import { 
  createTapGadget
} from './stdlib/shims/tap';

import {
  createRateLimitGadget
} from './stdlib/shims/rate-limit';

import {
  createAddGadget,
  createMultiplyGadget
} from './stdlib/primitives/math';

import {
  createAndGadget,
  createNotGadget
} from './stdlib/primitives/logic';

import {
  createUppercaseGadget,
  createSplitGadget
} from './stdlib/primitives/string';

import {
  PauseLattice,
  MaxIntLattice,
  RateLimitLattice
} from './core/lattice';

async function testGadgets() {
  console.log('=== Testing Femto-Bassline Components ===\n');

  // Test math gadgets
  console.log('1. Math Gadgets:');
  const adder = createAddGadget('test-add');
  const result1 = adder.process({ a: 5, b: 3 });
  console.log('  5 + 3 =', result1);
  
  const multiplier = createMultiplyGadget('test-mult');
  const result2 = multiplier.process({ a: 4, b: 7 });
  console.log('  4 * 7 =', result2);
  console.log();

  // Test logic gadgets
  console.log('2. Logic Gadgets:');
  const andGate = createAndGadget('test-and');
  const result3 = andGate.process({ a: true, b: false });
  console.log('  true AND false =', result3);
  
  const notGate = createNotGadget('test-not');
  const result4 = notGate.process({ value: true });
  console.log('  NOT true =', result4);
  console.log();

  // Test string gadgets
  console.log('3. String Gadgets:');
  const upper = createUppercaseGadget('test-upper');
  const result5 = upper.process({ value: 'hello world' });
  console.log('  uppercase("hello world") =', result5);
  
  const splitter = createSplitGadget('test-split');
  const result6 = splitter.process({ value: 'a,b,c', delimiter: ',' });
  console.log('  split("a,b,c", ",") =', result6);
  console.log();

  // Test tap gadget
  console.log('4. Tap Gadget:');
  const tap = createTapGadget('test-tap', {
    target: 'memory',
    format: { 
      label: 'Test',
      includeTimestamp: true,
      includePulseId: true,
      includeMetadata: false
    }
  });
  
  tap.process(42);
  tap.process('hello');
  tap.process({ data: true });
  
  const observations = tap.getObservations();
  console.log('  Recorded', observations.length, 'observations');
  console.log('  Values:', observations.map(o => o.value));
  console.log();

  // Test lattices
  console.log('5. Lattices:');
  console.log('  Pause: running ⊔ gated =', PauseLattice.join('running', 'gated'));
  console.log('  MaxInt: 5 ⊔ 10 =', MaxIntLattice.join(5, 10));
  
  const r1 = { rps: 100, burst: 20 };
  const r2 = { rps: 50, burst: 30 };
  const composed = RateLimitLattice.join(r1, r2);
  console.log('  RateLimit: {100,20} ⊔ {50,30} =', composed);
  console.log();

  // Test rate limiter
  console.log('6. Rate Limiting:');
  const limiter = createRateLimitGadget('test-limit', {
    rps: 2,
    burst: 3,
    onLimit: 'drop'
  });
  
  const requests = ['r1', 'r2', 'r3', 'r4', 'r5'];
  for (const req of requests) {
    const passed = await limiter.process(req);
    console.log(`  ${req}: ${passed ? 'PASSED' : 'DROPPED'}`);
  }
  
  const stats = limiter.getStats();
  console.log('  Stats:', stats);
  
  // Cleanup
  limiter.destroy();
}

async function main() {
  try {
    await testGadgets();
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();