#!/usr/bin/env tsx

/**
 * Simple adder example - minimal test of propagation network
 */

import { brand } from '../core/types';
import { GraphExecutor } from '../runtime/graph-executor';
import { AspectRegistry } from '../runtime/aspects';
import { createAddGadget } from '../stdlib/primitives/math-v2';
import { NumberLattice } from '../core/lattice';

async function main() {
  console.log('➕ Simple Adder Example\n');
  
  // Create executor
  const executor = new GraphExecutor(new AspectRegistry(), {
    enableDebugLogging: true
  });
  
  // Register adder gadget
  const addGadget = createAddGadget('add');
  executor.registerGadget('add', addGadget);
  
  // Create a minimal board
  const boardId = brand.boardId('board://simple');
  const mathPinout = brand.pinoutId('pinout://math');
  const adderSlot = brand.slotId('slot://adder');
  
  const boardIR = {
    id: boardId,
    slots: {
      [adderSlot]: {
        id: adderSlot,
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
  
  // Initialize board
  console.log('📋 Initializing board...\n');
  const context = await executor.initializeBoard(boardId, boardIR);
  
  // Mount the adder
  const adderId = brand.gadgetId('gadget://add-1');
  await executor.mountGadget(boardId, adderSlot, adderId, 'add');
  
  // Create and register contacts
  const inputA = brand.contactId('contact://input-a');
  const inputB = brand.contactId('contact://input-b');
  const adderInputA = brand.contactId(`${adderId}:a`);
  const adderInputB = brand.contactId(`${adderId}:b`);
  const adderOutput = brand.contactId(`${adderId}:result`);
  const output = brand.contactId('contact://output');
  
  context.contactStore.registerContact(inputA, NumberLattice);
  context.contactStore.registerContact(inputB, NumberLattice);
  context.contactStore.registerContact(output, NumberLattice);
  
  // Wire connections
  console.log('🔌 Wiring connections...\n');
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
    output
  );
  
  // Test the adder
  console.log('🧪 Testing:\n');
  
  // Set input values and propagate
  console.log('Setting A=5');
  await context.propagationEngine.propagate(inputA, 5);
  
  console.log('Setting B=3');
  await context.propagationEngine.propagate(inputB, 3);
  
  // Check contact values
  console.log('\n📊 Contact values:');
  console.log(`  inputA: ${context.contactStore.getValue(inputA)}`);
  console.log(`  inputB: ${context.contactStore.getValue(inputB)}`);
  console.log(`  adderInputA: ${context.contactStore.getValue(adderInputA)}`);
  console.log(`  adderInputB: ${context.contactStore.getValue(adderInputB)}`);
  console.log(`  adderOutput: ${context.contactStore.getValue(adderOutput)}`);
  console.log(`  output: ${context.contactStore.getValue(output)}`);
  
  // Manually trigger gadget execution to test
  console.log('\n🔧 Manually executing adder gadget:');
  await executor.executeGadget(boardId, adderId);
  
  // Check values again
  console.log('\n📊 Contact values after execution:');
  console.log(`  adderOutput: ${context.contactStore.getValue(adderOutput)}`);
  console.log(`  output: ${context.contactStore.getValue(output)}`);
  
  // Now propagate from adder output
  console.log('\n🌊 Propagating from adder output:');
  const adderResult = context.contactStore.getValue(adderOutput);
  
  // Debug: check connections
  console.log('\n🔍 Debugging connections:');
  const adderConnections = context.contactStore.getConnections(adderOutput);
  console.log(`  Connections from adderOutput: ${adderConnections.size}`);
  for (const conn of adderConnections) {
    console.log(`    ${conn.fromContact} -> ${conn.toContact}`);
  }
  
  const downstreamContacts = context.contactStore.getDownstreamContacts(adderOutput);
  console.log(`  Downstream contacts: ${downstreamContacts}`);
  
  if (adderResult !== undefined) {
    const stats = await context.propagationEngine.propagate(adderOutput, adderResult);
    console.log(`  Propagation stats:`);
    console.log(`    Tasks: ${stats.tasksProcessed}`);
    console.log(`    Changes: ${stats.valuesChanged}`);
  }
  
  console.log('\n📊 Final values:');
  console.log(`  output: ${context.contactStore.getValue(output)}`);
  
  // Cleanup
  executor.cleanup(boardId);
  console.log('\n✅ Test complete!');
}

main().catch(console.error);