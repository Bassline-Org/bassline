import { OrdinalCell } from './src/cells/basic'
import { num, getMapValue, getOrdinal, ordinalValue } from './src/types'

const cell = new OrdinalCell('test')

// Set initial value
console.log('Setting initial value with ordinal 1, value 10')
cell.accept(ordinalValue(1, num(10)), cell)
console.log('Current:', getMapValue(cell.getOutput())?.value, 'ordinal:', getOrdinal(cell.getOutput()))

console.log('\nCalling userInput(num(20)) - should be ordinal 1 (incremented from 0)')
cell.userInput(num(20))
console.log('Current:', getMapValue(cell.getOutput())?.value, 'ordinal:', getOrdinal(cell.getOutput()))

console.log('\nCalling userInput(num(30)) - should be ordinal 2')
cell.userInput(num(30))
console.log('Current:', getMapValue(cell.getOutput())?.value, 'ordinal:', getOrdinal(cell.getOutput()))