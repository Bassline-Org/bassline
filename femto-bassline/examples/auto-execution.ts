#!/usr/bin/env tsx

/**
 * Auto-execution example - demonstrates automatic gadget execution
 * when inputs change through propagation
 */

import { brand } from '../core/types';
import { GraphExecutor } from '../runtime/graph-executor';
import { AspectRegistry } from '../runtime/aspects';
import { createAddGadget, createMultiplyGadget } from '../stdlib/primitives/math-v2';
import { NumberLattice } from '../core/lattice';

async function main() {
  console.log('🤖 Auto-Execution Example\n');
  console.log('This example shows gadgets executing automatically when inputs change.\n');
  
  // Create executor (without debug logging for cleaner output)
  const executor = new GraphExecutor(new AspectRegistry(), {
    enableDebugLogging: false
  });
  
  // Register gadgets
  executor.registerGadget('add', createAddGadget('add'));
  executor.registerGadget('multiply', createMultiplyGadget('multiply'));
  
  // Create board
  const boardId = brand.boardId('board://auto');
  const mathPinout = brand.pinoutId('pinout://math');
  
  const boardIR = {
    id: boardId,
    slots: {
      'slot://add': {
        id: brand.slotId('slot://add'),
        requires: mathPinout,
        mode: { capacity: 1 }
      },
      'slot://multiply': {
        id: brand.slotId('slot://multiply'),
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
          'a': { kind: 'ValueIn' as const },
          'b': { kind: 'ValueIn' as const },
          'result': { kind: 'ValueOut' as const }
        }
      }
    }
  };
  
  // Initialize
  const context = await executor.initializeBoard(boardId, boardIR);
  
  // Mount gadgets
  const adderId = brand.gadgetId('gadget://add');
  const multiplierId = brand.gadgetId('gadget://multiply');
  
  await executor.mountGadget(boardId, brand.slotId('slot://add'), adderId, 'add');
  await executor.mountGadget(boardId, brand.slotId('slot://multiply'), multiplierId, 'multiply');
  
  // Create contacts
  const inputA = brand.contactId('contact://A');
  const inputB = brand.contactId('contact://B');
  const adderA = brand.contactId(`${adderId}:a`);
  const adderB = brand.contactId(`${adderId}:b`);
  const adderOut = brand.contactId(`${adderId}:result`);
  const multA = brand.contactId(`${multiplierId}:a`);
  const multB = brand.contactId(`${multiplierId}:b`);
  const multOut = brand.contactId(`${multiplierId}:result`);
  const finalOutput = brand.contactId('contact://output');
  
  // Register external contacts
  context.contactStore.registerContact(inputA, NumberLattice);
  context.contactStore.registerContact(inputB, NumberLattice);
  context.contactStore.registerContact(finalOutput, NumberLattice);
  
  // Wire: A -> adder.a, B -> adder.b
  context.contactStore.addConnection(brand.wireId('w1'), inputA, adderA);
  context.contactStore.addConnection(brand.wireId('w2'), inputB, adderB);
  
  // Wire: adder.result -> multiplier.a, B -> multiplier.b
  context.contactStore.addConnection(brand.wireId('w3'), adderOut, multA);
  context.contactStore.addConnection(brand.wireId('w4'), inputB, multB);
  
  // Wire: multiplier.result -> output
  context.contactStore.addConnection(brand.wireId('w5'), multOut, finalOutput);
  
  // Monitor execution events
  let adderExecutions = 0;
  let multiplierExecutions = 0;
  
  const unsubscribe = context.gadgetExecutor.onExecution((execution) => {
    if (execution.gadgetId === adderId) {
      adderExecutions++;
      console.log(`  ➕ Adder executed: ${Array.from(execution.inputValues.values())} → ${Array.from(execution.outputValues.values())}`);
    } else if (execution.gadgetId === multiplierId) {
      multiplierExecutions++;
      console.log(`  ✖️ Multiplier executed: ${Array.from(execution.inputValues.values())} → ${Array.from(execution.outputValues.values())}`);
    }
  });
  
  console.log('📝 Initial state:');
  console.log(`  A: ${context.contactStore.getValue(inputA) ?? 'undefined'}`);
  console.log(`  B: ${context.contactStore.getValue(inputB) ?? 'undefined'}`);
  console.log(`  Output: ${context.contactStore.getValue(finalOutput) ?? 'undefined'}\n`);
  
  // Test 1: Set A = 10
  console.log('🔄 Setting A = 10:');
  const stats1 = await context.propagationEngine.propagate(inputA, 10);
  console.log(`  Propagation: ${stats1.valuesChanged} values changed`);
  console.log(`  Adder inputs: a=${context.contactStore.getValue(adderA)}, b=${context.contactStore.getValue(adderB)}`);
  console.log(`  Output: ${context.contactStore.getValue(finalOutput)}`);
  console.log(`  (Executions - Adder: ${adderExecutions}, Multiplier: ${multiplierExecutions})\n`);
  
  // Test 2: Set B = 5 (should trigger both gadgets)
  console.log('🔄 Setting B = 5:');
  await context.propagationEngine.propagate(inputB, 5);
  console.log(`  Output: ${context.contactStore.getValue(finalOutput)}`);
  console.log(`  (Executions - Adder: ${adderExecutions}, Multiplier: ${multiplierExecutions})\n`);
  
  // Test 3: Update A = 20
  console.log('🔄 Updating A = 20:');
  await context.propagationEngine.propagate(inputA, 20);
  console.log(`  Output: ${context.contactStore.getValue(finalOutput)}`);
  console.log(`  (Executions - Adder: ${adderExecutions}, Multiplier: ${multiplierExecutions})\n`);
  
  // Test 4: Update B = 2
  console.log('🔄 Updating B = 2:');
  const stats4 = await context.propagationEngine.propagate(inputB, 2);
  console.log(`  Propagation: ${stats4.valuesChanged} values changed`);
  console.log(`  Adder inputs: a=${context.contactStore.getValue(adderA)}, b=${context.contactStore.getValue(adderB)}`);
  console.log(`  Adder output: ${context.contactStore.getValue(adderOut)}`);
  console.log(`  Multiplier inputs: a=${context.contactStore.getValue(multA)}, b=${context.contactStore.getValue(multB)}`);
  console.log(`  Output: ${context.contactStore.getValue(finalOutput)}`);
  console.log(`  (Executions - Adder: ${adderExecutions}, Multiplier: ${multiplierExecutions})\n`);
  
  console.log('📊 Summary:');
  console.log(`  Final output: ${context.contactStore.getValue(finalOutput)} (should be (20+2)*2 = 44)`);
  console.log(`  Total adder executions: ${adderExecutions}`);
  console.log(`  Total multiplier executions: ${multiplierExecutions}`);
  
  // Cleanup
  unsubscribe();
  executor.cleanup(boardId);
  
  console.log('\n✅ Auto-execution test complete!');
}

main().catch(console.error);