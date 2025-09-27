/**
 * Smart Resolver Example
 *
 * Shows a resolver that can synthesize missing types based on naming patterns
 * and context, demonstrating how errors as partial information enable
 * intelligent self-healing behavior.
 */

import { factoryBassline } from '../factoryBassline';
import { withTaps, defGadget, type Gadget } from '../../core/typed';
import { maxCell, minCell, lastCell } from '../../patterns/cells';

// Main bassline starts with no types
const main = withTaps(factoryBassline());

// Smart resolver that can synthesize types
const smartResolver = withTaps(factoryBassline());

// Define a "type synthesizer" gadget type in the resolver
smartResolver.receive({
  defineType: {
    name: 'synthesizer',
    factory: () => defGadget({
      dispatch: (state, input) => ({ synthesize: input }),
      methods: {
        synthesize: (gadget, request: any) => {
          console.log(`[Synthesizer] Analyzing request: ${JSON.stringify(request)}`);

          // Pattern matching on type names
          if (request.type.includes('max')) {
            console.log(`[Synthesizer] Pattern match: 'max' → creating maxCell`);
            return { synthesized: { type: request.type, factory: maxCell } };
          }

          if (request.type.includes('min')) {
            console.log(`[Synthesizer] Pattern match: 'min' → creating minCell`);
            return { synthesized: { type: request.type, factory: minCell } };
          }

          if (request.type.includes('last') || request.type.includes('current')) {
            console.log(`[Synthesizer] Pattern match: 'last/current' → creating lastCell`);
            return { synthesized: { type: request.type, factory: lastCell } };
          }

          // Could also look at context
          if (request.context?.includes('sensor')) {
            console.log(`[Synthesizer] Context match: 'sensor' → creating maxCell as default`);
            return { synthesized: { type: request.type, factory: maxCell } };
          }

          console.log(`[Synthesizer] No pattern match for ${request.type}`);
          return { failed: request };
        }
      }
    })({ /* initial state */ })
  }
});

// Create a synthesizer instance
smartResolver.receive({ spawn: { name: 'synth', type: 'synthesizer' } });
const synth = smartResolver.current().instances['synth'];

// Wire: Main's unknownType → Smart resolver
main.tap(({ unknownType, spawn }) => {
  if (unknownType) {
    console.log(`\n[Main] Unknown type: "${unknownType.type}"`);

    // Ask synthesizer to figure it out
    synth?.receive({
      type: unknownType.type,
      availableTypes: unknownType.availableTypes,
      context: 'unknown-from-main'
    });
  }

  // Track spawn attempts for context
  if (spawn) {
    // Could use spawn patterns to inform synthesis
    synth?.receive({
      observation: 'spawn-attempt',
      name: spawn.name,
      type: spawn.type
    });
  }
});

// Wire: Synthesizer results → Main
if (synth) {
  withTaps(synth).tap(({ synthesized }) => {
    if (synthesized) {
      console.log(`[Resolver → Main] Providing synthesized type: ${synthesized.type}`);
      main.receive({
        defineType: {
          name: synthesized.type,
          factory: synthesized.factory
        }
      });
    }
  });
}

// Demo: Try various unknown types
console.log('=== Smart Resolver Demo ===');

console.log('\n1. Trying type with "max" in name:');
main.receive({ spawn: { name: 'sensor1', type: 'maxSensor', args: [0] } });
main.receive({ spawn: { name: 'sensor1', type: 'maxSensor', args: [0] } });

console.log('\n2. Trying type with "min" in name:');
main.receive({ spawn: { name: 'limiter', type: 'minValue', args: [100] } });
main.receive({ spawn: { name: 'limiter', type: 'minValue', args: [100] } });

console.log('\n3. Trying type with "current" in name:');
main.receive({ spawn: { name: 'state', type: 'currentState', args: ['hello'] } });
main.receive({ spawn: { name: 'state', type: 'currentState', args: ['hello'] } });

console.log('\n4. Trying ambiguous type:');
main.receive({ spawn: { name: 'thing', type: 'something', args: [42] } });

// Check what we ended up with
console.log('\n=== Results ===');
console.log('Synthesized types:', Object.keys(main.current().types));
console.log('Created instances:', Object.keys(main.current().instances));

// Test that synthesized types work correctly
const instances = main.current().instances;
if (instances['sensor1']) {
  instances['sensor1'].receive(50);
  console.log(`\nsensor1 (synthesized max): ${instances['sensor1'].current()}`);
}
if (instances['limiter']) {
  instances['limiter'].receive(50);
  console.log(`limiter (synthesized min): ${instances['limiter'].current()}`);
}
if (instances['state']) {
  instances['state'].receive('world');
  console.log(`state (synthesized last): ${instances['state'].current()}`);
}

/**
 * Key Insights:
 *
 * 1. The resolver uses partial information (type names, context) to synthesize solutions
 * 2. Pattern matching on names is one strategy - could use ML, lookup tables, etc.
 * 3. The resolver itself is a bassline with gadgets that implement intelligence
 * 4. Errors flow as data, enabling creative solutions
 * 5. The system learns and adapts through observation of patterns
 */