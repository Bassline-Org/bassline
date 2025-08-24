#!/usr/bin/env npx tsx
/**
 * Test automatic propagation
 */

import { OrdinalCell, num } from './src/index'

console.log('Testing automatic propagation...\n')

// Create two cells
const cell1 = new OrdinalCell('source')
const cell2 = new OrdinalCell('target')

// Set initial values
cell1.userInput(num(10))
cell2.userInput(num(0))

console.log('Initial:')
const out1 = cell1.getOutput() as any
const out2 = cell2.getOutput() as any
console.log('  cell1:', out1 instanceof Map ? out1.get('value')?.value : out1)
console.log('  cell2:', out2 instanceof Map ? out2.get('value')?.value : out2)

// Connect cell2 to cell1
console.log('\nConnecting cell2 to cell1...')
cell2.connectFrom(cell1)

// The connection should have pulled the initial value
console.log('After connection:')
const out3 = cell1.getOutput() as any
const out4 = cell2.getOutput() as any
console.log('  cell1:', out3 instanceof Map ? out3.get('value')?.value : out3)
console.log('  cell2:', out4 instanceof Map ? out4.get('value')?.value : out4)

// Change cell1 - should auto-propagate to cell2
console.log('\nChanging cell1 to 20...')
cell1.userInput(num(20))

console.log('After change:')
const out5 = cell1.getOutput() as any
const out6 = cell2.getOutput() as any
console.log('  cell1:', out5 instanceof Map ? out5.get('value')?.value : out5)
console.log('  cell2:', out6 instanceof Map ? out6.get('value')?.value : out6)

// Check connections
console.log('\nConnection check:')
console.log('  cell1 downstream count:', cell1.downstream.size)
console.log('  cell1 upstream count:', cell1.upstream.size)
console.log('  cell2 downstream count:', cell2.downstream.size)
console.log('  cell2 upstream count:', cell2.upstream.size)
console.log('  cell2 inputs count:', cell2.inputs.size)