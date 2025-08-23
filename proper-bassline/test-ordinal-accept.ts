import { OrdinalCell } from './src/cells/basic'
import { num, ordinalValue, getMapValue } from './src/types'

const cell = new OrdinalCell('test')

console.log('Initial:', cell.getOutput())

console.log('\nUsing userInput with num(10):')
cell.userInput(num(10))
console.log('Output:', cell.getOutput())
console.log('Value:', getMapValue(cell.getOutput())?.value)

console.log('\nUsing userInput with num(20):')
cell.userInput(num(20))
console.log('Output:', cell.getOutput())
console.log('Value:', getMapValue(cell.getOutput())?.value)

console.log('\nUsing accept directly with ordinal 100, value 30:')
cell.accept(ordinalValue(100, num(30)), cell)
console.log('Output:', cell.getOutput())
console.log('Value:', getMapValue(cell.getOutput())?.value)