import { OrdinalCell } from './src/cells/basic'
import { num, ordinalValue, getMapValue } from './src/types'

// Test OrdinalCell behavior
const cell = new OrdinalCell('test')

console.log('Initial:', cell.getOutput())

console.log('\n1. Set to ordinal 1, value 10')
cell.setOutput('default', ordinalValue(1, num(10)))
console.log('Output:', cell.getOutput())
console.log('Value:', getMapValue(cell.getOutput())?.value)

console.log('\n2. Set to ordinal 2, value 20')
cell.setOutput('default', ordinalValue(2, num(20)))
console.log('Output:', cell.getOutput())
console.log('Value:', getMapValue(cell.getOutput())?.value)

console.log('\n3. Set to ordinal 1, value 30 (lower ordinal)')
cell.setOutput('default', ordinalValue(1, num(30)))
console.log('Output:', cell.getOutput())
console.log('Value:', getMapValue(cell.getOutput())?.value, '(should still be 20)')