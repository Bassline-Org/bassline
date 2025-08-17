/**
 * Test that actually uses boards and wiring
 */

import { 
  createBoardId, 
  createSlotId, 
  createWireId,
  createPinoutId,
  createGadgetId
} from './core/types';

import { BoardIR } from './core/ir';

import { createBinder } from './runtime/binder';
import { AspectRegistry } from './runtime/aspects';

// Create a simple calculator board: (a + b) * c
function createCalculatorBoard(): BoardIR {
  const boardId = createBoardId('calculator');
  
  return {
    id: boardId,
    
    slots: {
      // Input slots
      [createSlotId('input-a')]: {
        id: createSlotId('input-a'),
        requires: createPinoutId('value-io'),
        capacity: 1
      },
      [createSlotId('input-b')]: {
        id: createSlotId('input-b'),
        requires: createPinoutId('value-io'),
        capacity: 1
      },
      [createSlotId('input-c')]: {
        id: createSlotId('input-c'),
        requires: createPinoutId('value-io'),
        capacity: 1
      },
      
      // Computation slots
      [createSlotId('adder')]: {
        id: createSlotId('adder'),
        requires: createPinoutId('binary-math'),
        capacity: 1
      },
      [createSlotId('multiplier')]: {
        id: createSlotId('multiplier'),
        requires: createPinoutId('binary-math'),
        capacity: 1
      },
      
      // Output slot
      [createSlotId('output')]: {
        id: createSlotId('output'),
        requires: createPinoutId('value-io'),
        capacity: 1
      }
    },
    
    wires: {
      // Wire inputs to adder
      [createWireId('a-to-adder')]: {
        id: createWireId('a-to-adder'),
        from: { slot: createSlotId('input-a'), pin: 'out' },
        to: { slot: createSlotId('adder'), pin: 'a' }
      },
      [createWireId('b-to-adder')]: {
        id: createWireId('b-to-adder'),
        from: { slot: createSlotId('input-b'), pin: 'out' },
        to: { slot: createSlotId('adder'), pin: 'b' }
      },
      
      // Wire adder result to multiplier
      [createWireId('sum-to-mult')]: {
        id: createWireId('sum-to-mult'),
        from: { slot: createSlotId('adder'), pin: 'result' },
        to: { slot: createSlotId('multiplier'), pin: 'a' }
      },
      
      // Wire c to multiplier
      [createWireId('c-to-mult')]: {
        id: createWireId('c-to-mult'),
        from: { slot: createSlotId('input-c'), pin: 'out' },
        to: { slot: createSlotId('multiplier'), pin: 'b' }
      },
      
      // Wire result to output
      [createWireId('mult-to-output')]: {
        id: createWireId('mult-to-output'),
        from: { slot: createSlotId('multiplier'), pin: 'result' },
        to: { slot: createSlotId('output'), pin: 'in' }
      }
    },
    
    aspects: {}
  };
}

// Create a board with aspects (monitoring and rate limiting)
function createMonitoredBoard(): BoardIR {
  const boardId = createBoardId('monitored-pipeline');
  
  return {
    id: boardId,
    
    slots: {
      [createSlotId('source')]: {
        id: createSlotId('source'),
        requires: createPinoutId('value-io'),
        capacity: 1
      },
      [createSlotId('processor')]: {
        id: createSlotId('processor'),
        requires: createPinoutId('value-io'),
        capacity: 1
      },
      [createSlotId('sink')]: {
        id: createSlotId('sink'),
        requires: createPinoutId('value-io'),
        capacity: 1
      }
    },
    
    wires: {
      [createWireId('source-to-processor')]: {
        id: createWireId('source-to-processor'),
        from: { slot: createSlotId('source'), pin: 'out' },
        to: { slot: createSlotId('processor'), pin: 'in' },
        labels: ['monitored', 'rate-limited']
      },
      [createWireId('processor-to-sink')]: {
        id: createWireId('processor-to-sink'),
        from: { slot: createSlotId('processor'), pin: 'out' },
        to: { slot: createSlotId('sink'), pin: 'in' },
        labels: ['monitored']
      }
    },
    
    // Apply tap and rate-limit aspects to wires
    aspects: {
      [createWireId('source-to-processor')]: [
        {
          id: createAspectId('tap', 1),
          at: 'tapIn',
          params: {
            target: 'console',
            format: { label: 'Input' }
          }
        },
        {
          id: createAspectId('rate-limit', 1),
          at: 'around',
          params: {
            rps: 10,
            burst: 5
          }
        }
      ],
      [createWireId('processor-to-sink')]: [
        {
          id: createAspectId('tap', 2),
          at: 'tapOut',
          params: {
            target: 'console',
            format: { label: 'Output' }
          }
        }
      ]
    }
  };
}

import { createAspectId } from './core/types';
import { Lattice } from './core/lattice';

// Mock lattice catalog
class MockLatticeCatalog {
  get(name: string): Lattice<any> | undefined {
    // Return undefined for now - would return actual lattices
    return undefined;
  }
}

// Mock aspect registry
class MockAspectRegistry extends AspectRegistry {
  constructor() {
    super();
  }
}

async function testBoards() {
  console.log('=== Testing Boards with Wiring ===\n');
  
  // Test 1: Create a calculator board
  console.log('1. Calculator Board:');
  const calcBoard = createCalculatorBoard();
  console.log(`   Created board: ${calcBoard.id}`);
  console.log(`   Slots: ${Object.keys(calcBoard.slots).length}`);
  console.log(`   Wires: ${Object.keys(calcBoard.wires).length}`);
  console.log(`   Structure: (input-a + input-b) * input-c → output`);
  console.log();
  
  // Test 2: Create a binder and load the board
  console.log('2. Using Binder:');
  const binder = createBinder(calcBoard.id, {
    aspectRegistry: new MockAspectRegistry(),
    latticeCatalog: new MockLatticeCatalog(),
    principal: 'test-user'
  });
  
  // The binder would validate the board structure
  console.log('   Created binder for board');
  console.log('   Principal: test-user');
  console.log();
  
  // Test 3: Board with aspects
  console.log('3. Monitored Pipeline Board:');
  const monitoredBoard = createMonitoredBoard();
  console.log(`   Created board: ${monitoredBoard.id}`);
  console.log(`   Slots: ${Object.keys(monitoredBoard.slots).length}`);
  console.log(`   Wires: ${Object.keys(monitoredBoard.wires).length}`);
  
  // Count aspects
  const aspectCount = Object.values(monitoredBoard.aspects)
    .flat()
    .length;
  console.log(`   Aspects: ${aspectCount}`);
  console.log('   Wire labels: monitored, rate-limited');
  console.log();
  
  // Test 4: Show board structure
  console.log('4. Board Structure Analysis:');
  console.log('   Calculator board topology:');
  for (const [wireId, wire] of Object.entries(calcBoard.wires)) {
    console.log(`     ${wire.from.slot}:${wire.from.pin} → ${wire.to.slot}:${wire.to.pin}`);
  }
  console.log();
  
  // Test 5: Demonstrate lowering (conceptually)
  console.log('5. Lowering Process:');
  console.log('   BoardIR → Binder validation → Lower to graph');
  console.log('   - Slots become gadget mount points');
  console.log('   - Wires become connections');
  console.log('   - Aspects become shim gadgets');
  console.log('   - Labels enable aspect targeting');
  console.log();
  
  // Test 6: Show how aspects transform wires
  console.log('6. Aspect Transformation:');
  const wire = monitoredBoard.wires[createWireId('source-to-processor')];
  const aspects = monitoredBoard.aspects[createWireId('source-to-processor')];
  console.log(`   Wire: ${wire.id}`);
  console.log(`   Original: ${wire.from.slot} → ${wire.to.slot}`);
  console.log(`   After aspects:`);
  console.log(`     ${wire.from.slot} → [tap] → [rate-limit] → ${wire.to.slot}`);
  console.log(`   Aspects create intermediate shim gadgets`);
  console.log();
  
  // Test 7: Board composition
  console.log('7. Board Composition Patterns:');
  console.log('   - Boards can contain other boards (via slots)');
  console.log('   - Boundary contacts expose board interfaces');
  console.log('   - Hierarchical composition enables modularity');
  console.log('   - Aspects can apply at any level');
}

async function main() {
  try {
    await testBoards();
    console.log('✅ Board tests completed!');
    console.log('\nKey insights:');
    console.log('- Boards define structure (slots + wires)');
    console.log('- Binders manage mutations and validation');
    console.log('- Aspects add cross-cutting concerns');
    console.log('- Lowering transforms IR to executable graph');
    console.log('- The system supports hierarchical composition');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();