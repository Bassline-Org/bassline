/**
 * Composed Basslines Example
 *
 * Shows how basslines can observe each other's effects and collaborate.
 * Errors from one become inputs to another for self-healing behavior.
 */

import { factoryBassline } from '../factoryBassline';
import { withTaps } from '../../core/typed';
import { maxCell, lastCell, minCell, unionCell } from '../../patterns/cells';

// Create the main bassline
const main = withTaps(factoryBassline());

// Create a type registry bassline that knows about many types
const typeRegistry = withTaps(factoryBassline({
  max: maxCell,
  min: minCell,
  last: lastCell,
  union: unionCell,
  // Could have many more types...
}));

// Create a resolver bassline that actively resolves missing capabilities
const resolver = withTaps(factoryBassline());

// Give the resolver some intelligence about common patterns
resolver.receive({
  defineType: {
    name: 'typeResolver',
    factory: (request: { type: string; context?: string }) => {
      // A simple gadget that holds resolution requests
      return {
        current: () => request,
        update: () => {},
        receive: () => {},
        emit: () => {}
      };
    }
  }
});

// Wire: Main's unknownType errors → Resolver
main.tap(({ unknownType }) => {
  if (unknownType) {
    console.log(`[Main] Unknown type: ${unknownType.type}, available: ${unknownType.availableTypes.join(', ')}`);

    // Resolver analyzes the request
    resolver.receive({
      spawn: {
        name: `resolve-${unknownType.type}`,
        type: 'typeResolver',
        args: [{ type: unknownType.type, context: 'missing-type' }]
      }
    });
  }
});

// Wire: Resolver actively searches for solutions
resolver.tap(({ spawned }) => {
  if (spawned && spawned.type === 'typeResolver') {
    const request = spawned.instance.current();
    console.log(`[Resolver] Analyzing request for type: ${request.type}`);

    // First, check the type registry
    const registryTypes = typeRegistry.current().types;
    const factory = registryTypes[request.type];

    if (factory) {
      console.log(`[Resolver] Found ${request.type} in registry!`);
      // Provide it to main
      main.receive({
        defineType: {
          name: request.type,
          factory: factory
        }
      });
    } else {
      console.log(`[Resolver] Type ${request.type} not in registry, could search elsewhere...`);
      // Could implement other strategies:
      // - Query remote registries
      // - Synthesize based on naming patterns
      // - Ask user for help
      // - Create a default implementation
    }
  }
});

// Wire: Main's successful spawns can update resolver's knowledge
main.tap(({ spawned }) => {
  if (spawned) {
    console.log(`[Main] Successfully spawned ${spawned.name} of type ${spawned.type}`);
  }
});

// Example usage showing self-healing behavior
console.log('\n=== Composed Basslines Demo ===\n');

// Try to spawn a type that main doesn't know about
console.log('1. Trying to spawn unknown type "max"...');
main.receive({ spawn: { name: 'sensor1', type: 'max', args: [0] } });

// The error triggered resolver to get the type from registry
// Now try again - it should work!
console.log('\n2. Trying again...');
main.receive({ spawn: { name: 'sensor1', type: 'max', args: [10] } });

// Try another unknown type
console.log('\n3. Trying to spawn unknown type "min"...');
main.receive({ spawn: { name: 'sensor2', type: 'min', args: [100] } });
main.receive({ spawn: { name: 'sensor2', type: 'min', args: [100] } });

// Create connections
console.log('\n4. Creating connections...');
main.receive({ connect: { id: 'link1', from: 'sensor1', to: 'sensor2' } });

// Test the connection works
const sensor1 = main.current().instances['sensor1'];
const sensor2 = main.current().instances['sensor2'];

if (sensor1 && sensor2) {
  console.log(`\n5. Testing connection...`);
  console.log(`   sensor1 (max): ${sensor1.current()}`);
  console.log(`   sensor2 (min): ${sensor2.current()}`);

  sensor1.receive(150);  // Higher than current max (10)
  console.log(`   After sensor1.receive(150):`);
  console.log(`   sensor1 (max) is now: ${sensor1.current()}`);
  console.log(`   sensor2 (min) is now: ${sensor2.current()}`);
} else {
  console.log(`\n5. Instances not created yet (sensor1: ${!!sensor1}, sensor2: ${!!sensor2})`);
}

// Example: Pattern discovery
console.log('\n=== Pattern Discovery ===\n');

// Another bassline that provides custom patterns
const patternLibrary = withTaps(factoryBassline());

// Define some useful patterns
patternLibrary.receive({
  definePattern: {
    name: 'doubler',
    pattern: (from: any, to: any) => {
      const cleanup = from.tap((e: any) => {
        if ('changed' in e && e.changed !== undefined) {
          to.receive(e.changed * 2);
        }
      });
      return { cleanup };
    }
  }
});

// Wire: Main's unknownPattern errors → Pattern library
main.tap(({ unknownPattern }) => {
  if (unknownPattern) {
    console.log(`Unknown pattern: ${unknownPattern.pattern}`);
    console.log(`Available: ${unknownPattern.availablePatterns.join(', ')}`);

    // Check if pattern library has it
    const patterns = patternLibrary.current().patterns;
    const pattern = patterns[unknownPattern.pattern];

    if (pattern) {
      console.log(`Found pattern "${unknownPattern.pattern}" in library!`);
      main.receive({
        definePattern: {
          name: unknownPattern.pattern,
          pattern: pattern
        }
      });
    }
  }
});

// Try to use unknown pattern
console.log('Trying to use unknown "doubler" pattern...');
main.receive({ spawn: { name: 'output', type: 'max', args: [0] } });
main.receive({ connect: { id: 'double-link', from: 'sensor1', to: 'output', pattern: 'doubler' } });

// Should fail first, then succeed after pattern is provided
main.receive({ connect: { id: 'double-link', from: 'sensor1', to: 'output', pattern: 'doubler' } });

// Test the doubler pattern
const output = main.current().instances['output'];
if (sensor1 && output) {
  sensor1.receive(200);  // Higher than current max (150)
  console.log(`\nAfter sensor1.receive(200):`);
  console.log(`sensor1 (max): ${sensor1.current()}`);
  console.log(`output (with doubler): ${output.current()}`); // Should be 400
}

console.log('\n=== Summary ===');
console.log('Main bassline now has:');
console.log(`  Types: ${Object.keys(main.current().types).join(', ')}`);
console.log(`  Instances: ${Object.keys(main.current().instances).join(', ')}`);
console.log(`  Connections: ${Object.keys(main.current().connections).join(', ')}`);
console.log(`  Patterns: ${Object.keys(main.current().patterns).join(', ')}`);

/**
 * Key Insights:
 *
 * 1. Errors are partial information - they tell other gadgets what's missing
 * 2. Basslines collaborate by observing each other's effects
 * 3. The system becomes self-healing through composition
 * 4. No special error handling - just gadgets talking to gadgets
 * 5. Knowledge can be distributed across multiple basslines
 */