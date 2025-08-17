#!/usr/bin/env tsx

/**
 * Calculator example - demonstrates a working propagation network
 * with gadgets, boards, and live value propagation.
 */

import { 
  BoardId,
  BoardIR,
  SlotDecl,
  WireSpec,
  PinoutId,
  SlotId,
  GadgetId,
  ContactId,
  WireId
} from '../core/types';
import { brand } from '../core/types';
import { GraphExecutor } from '../runtime/graph-executor';
import { AspectRegistry } from '../runtime/aspects';
import { createAddGadget, createMultiplyGadget } from '../stdlib/primitives/math-v2';

async function main() {
  console.log('🧮 Femto-Bassline Calculator Example\n');
  console.log('This example creates a simple calculator using propagation networks.\n');
  
  // Create runtime components
  const aspectRegistry = new AspectRegistry();
  // Note: Aspects are optional, not using them for this basic example
  
  const executor = new GraphExecutor(aspectRegistry, {
    enableDebugLogging: true
  });
  
  // Register gadgets in the library
  const addGadget = createAddGadget('add');
  const multiplyGadget = createMultiplyGadget('multiply');
  
  executor.registerGadget('add', addGadget);
  executor.registerGadget('multiply', multiplyGadget);
  
  // Define the calculator board IR
  const boardId = brand.boardId('board://calculator');
  const mathPinout = brand.pinoutId('pinout://math');
  
  // Define slots for our calculator
  const adderSlot = brand.slotId('slot://adder');
  const multiplierSlot = brand.slotId('slot://multiplier');
  
  const boardIR: BoardIR = {
    id: boardId,
    slots: {
      [adderSlot]: {
        id: adderSlot,
        requires: mathPinout,
        mode: { capacity: 1 }
      },
      [multiplierSlot]: {
        id: multiplierSlot,
        requires: mathPinout,
        mode: { capacity: 1 }
      }
    },
    occupants: {},
    wires: {},
    pinouts: {
      [mathPinout]: {
        id: mathPinout,
        pins: {
          'a': { kind: 'ValueIn' },
          'b': { kind: 'ValueIn' },
          'result': { kind: 'ValueOut' }
        }
      }
    }
  };
  
  // Initialize the board
  console.log('📋 Initializing calculator board...\n');
  const context = await executor.initializeBoard(boardId, boardIR);
  
  // Mount gadgets into slots
  const adderId = brand.gadgetId('gadget://add-1');
  const multiplierId = brand.gadgetId('gadget://multiply-1');
  
  console.log('🔧 Mounting gadgets...\n');
  await executor.mountGadget(boardId, adderSlot, adderId, 'add');
  await executor.mountGadget(boardId, multiplierSlot, multiplierId, 'multiply');
  
  // Create contacts for inputs and outputs
  const inputA = brand.contactId('contact://input-a');
  const inputB = brand.contactId('contact://input-b');
  const adderInputA = brand.contactId(`${adderId}:a`);
  const adderInputB = brand.contactId(`${adderId}:b`);
  const adderOutput = brand.contactId(`${adderId}:result`);
  const multiplierInputA = brand.contactId(`${multiplierId}:a`);
  const multiplierInputB = brand.contactId(`${multiplierId}:b`);
  const multiplierOutput = brand.contactId(`${multiplierId}:result`);
  const finalOutput = brand.contactId('contact://final-output');
  
  // Register the input and output contacts
  const { NumberLattice } = await import('../core/lattice');
  context.contactStore.registerContact(inputA, NumberLattice);
  context.contactStore.registerContact(inputB, NumberLattice);
  context.contactStore.registerContact(finalOutput, NumberLattice);
  
  // Wire up the calculator: 
  // inputA -> adder.a
  // inputB -> adder.b
  // adder.result -> multiplier.a
  // inputB -> multiplier.b (multiply sum by B)
  // multiplier.result -> finalOutput
  
  console.log('🔌 Wiring up the network...\n');
  
  // Note: In a real implementation, we'd add these connections through the binder
  // For now, we'll add them directly to the contact store
  context.contactStore.addConnection(
    brand.wireId('wire://1'),
    inputA,
    adderInputA
  );
  context.contactStore.addConnection(
    brand.wireId('wire://2'),
    inputB,
    adderInputB
  );
  context.contactStore.addConnection(
    brand.wireId('wire://3'),
    adderOutput,
    multiplierInputA
  );
  context.contactStore.addConnection(
    brand.wireId('wire://4'),
    inputB,
    multiplierInputB
  );
  context.contactStore.addConnection(
    brand.wireId('wire://5'),
    multiplierOutput,
    finalOutput
  );
  
  // Test the calculator
  console.log('🧪 Testing the calculator:\n');
  console.log('Formula: (A + B) * B\n');
  
  // Test case 1: A=5, B=3 => (5+3)*3 = 24
  console.log('Test 1: A=5, B=3');
  await executor.updateContact(boardId, inputA, 5);
  await executor.updateContact(boardId, inputB, 3);
  
  // Force execution to see results
  await executor.executeGadget(boardId, adderId);
  await executor.executeGadget(boardId, multiplierId);
  
  const result1 = context.contactStore.getValue(finalOutput);
  console.log(`Result: ${result1} (expected: 24)\n`);
  
  // Test case 2: Update A=10, B=3 => (10+3)*3 = 39
  console.log('Test 2: A=10, B=3');
  await executor.updateContact(boardId, inputA, 10);
  
  await executor.executeGadget(boardId, adderId);
  await executor.executeGadget(boardId, multiplierId);
  
  const result2 = context.contactStore.getValue(finalOutput);
  console.log(`Result: ${result2} (expected: 39)\n`);
  
  // Test case 3: Update B=5 => (10+5)*5 = 75
  console.log('Test 3: A=10, B=5');
  await executor.updateContact(boardId, inputB, 5);
  
  await executor.executeGadget(boardId, adderId);
  await executor.executeGadget(boardId, multiplierId);
  
  const result3 = context.contactStore.getValue(finalOutput);
  console.log(`Result: ${result3} (expected: 75)\n`);
  
  // Show final statistics
  console.log('\n📊 Execution Statistics:');
  const stats = executor.getStats(boardId);
  if (stats) {
    console.log(`  Contacts: ${stats.contacts.contactCount}`);
    console.log(`  Connections: ${stats.contacts.connectionCount}`);
    console.log(`  Slots: ${stats.slots.slotCount}`);
    console.log(`  Mounted gadgets: ${stats.slots.mountedGadgetCount}`);
    console.log(`  Propagation tasks: ${stats.propagation.tasksProcessed}`);
    console.log(`  Values changed: ${stats.propagation.valuesChanged}`);
    
    console.log('\n  Gadget executions:');
    for (const [gadgetId, execStats] of stats.executions) {
      console.log(`    ${gadgetId}:`);
      console.log(`      Total: ${execStats.totalExecutions}`);
      console.log(`      Successful: ${execStats.successfulExecutions}`);
      console.log(`      Average duration: ${execStats.averageDuration.toFixed(2)}ms`);
    }
  }
  
  // Cleanup
  executor.cleanup(boardId);
  console.log('\n✅ Calculator example complete!');
}

// Run the example
main().catch(console.error);