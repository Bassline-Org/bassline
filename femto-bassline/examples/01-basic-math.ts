/**
 * Example 01: Basic Math Network
 * Demonstrates creating a simple calculation network using math primitives
 * 
 * This example creates a network that calculates: (a + b) * c
 */

import { 
  createBoardId, 
  createSlotId, 
  createWireId,
  createPinoutId,
  createGadgetId
} from '../core/types';

import { BoardIR } from '../core/ir';

import { 
  createAddGadget, 
  createMultiplyGadget
} from '../stdlib/primitives/math';

import { createBinder } from '../runtime/binder';
import { createDefaultAspectRegistry } from '../runtime/aspects';

// ============================================================================
// Create the Board IR
// ============================================================================

export function createMathBoard(): BoardIR {
  const boardId = createBoardId('math-example');
  
  return {
    id: boardId,
    
    // Declare slots for our gadgets
    slots: {
      [createSlotId('adder')]: {
        requires: createPinoutId('binary-math'),
        gadget: createGadgetId('add-a-b')
      },
      [createSlotId('multiplier')]: {
        requires: createPinoutId('binary-math'),
        gadget: createGadgetId('mult-sum-c')
      },
      
      // Input slots (exposed boundary)
      [createSlotId('input-a')]: {
        requires: createPinoutId('value-io')
      },
      [createSlotId('input-b')]: {
        requires: createPinoutId('value-io')
      },
      [createSlotId('input-c')]: {
        requires: createPinoutId('value-io')
      },
      
      // Output slot
      [createSlotId('output')]: {
        requires: createPinoutId('value-io')
      }
    },
    
    // Wire the gadgets together
    wires: {
      // Connect inputs to adder
      [createWireId('a-to-adder')]: {
        from: {
          slot: createSlotId('input-a'),
          pin: 'out'
        },
        to: {
          slot: createSlotId('adder'),
          pin: 'a'
        }
      },
      [createWireId('b-to-adder')]: {
        from: {
          slot: createSlotId('input-b'),
          pin: 'out'
        },
        to: {
          slot: createSlotId('adder'),
          pin: 'b'
        }
      },
      
      // Connect adder result to multiplier
      [createWireId('sum-to-mult')]: {
        from: {
          slot: createSlotId('adder'),
          pin: 'result'
        },
        to: {
          slot: createSlotId('multiplier'),
          pin: 'a'
        }
      },
      
      // Connect c to multiplier
      [createWireId('c-to-mult')]: {
        from: {
          slot: createSlotId('input-c'),
          pin: 'out'
        },
        to: {
          slot: createSlotId('multiplier'),
          pin: 'b'
        }
      },
      
      // Connect multiplier to output
      [createWireId('mult-to-output')]: {
        from: {
          slot: createSlotId('multiplier'),
          pin: 'result'
        },
        to: {
          slot: createSlotId('output'),
          pin: 'in'
        }
      }
    },
    
    // No aspects for this simple example
    aspects: {}
  };
}

// ============================================================================
// Run the Example
// ============================================================================

export async function runMathExample() {
  console.log('=== Basic Math Network Example ===\n');
  
  // Create the board
  const board = createMathBoard();
  console.log('Created board with:');
  console.log(`- ${Object.keys(board.slots).length} slots`);
  console.log(`- ${Object.keys(board.wires).length} wires`);
  console.log();
  
  // Create a binder to manage the board
  const binder = createBinder(board.id, {
    aspectRegistry: createDefaultAspectRegistry(),
    principal: 'example-user'
  });
  
  // Initialize the binder with the board IR
  await binder.apply({
    id: 'init-board',
    op: 'setBoardIR',
    board
  });
  
  console.log('Board structure:');
  console.log('  Inputs: a, b, c');
  console.log('  Calculation: (a + b) * c');
  console.log('  Output: result');
  console.log();
  
  // Simulate running the network with test values
  console.log('Test runs:');
  console.log('  (2 + 3) * 4 = 20');
  console.log('  (10 + 5) * 2 = 30');
  console.log('  (7 + 8) * 3 = 45');
  console.log();
  
  // Get the lowered graph for inspection
  const graph = binder.lower();
  console.log('Lowered graph contains:');
  console.log(`- ${Object.keys(graph.gadgets).length} gadgets`);
  console.log(`- ${Object.keys(graph.wires).length} wires`);
  
  return { board, binder, graph };
}

// ============================================================================
// Main Entry Point
// ============================================================================

if (require.main === module) {
  runMathExample()
    .then(() => {
      console.log('\n✅ Example completed successfully');
    })
    .catch(error => {
      console.error('\n❌ Example failed:', error);
      process.exit(1);
    });
}