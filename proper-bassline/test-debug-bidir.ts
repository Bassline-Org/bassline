import { OrdinalCell } from './src/cells/basic'
import { num, getMapValue } from './src/types'

// Test simple bidirectional connection
const cell1 = new OrdinalCell('cell1')
const cell2 = new OrdinalCell('cell2')

// Connect bidirectionally
cell1.from(cell2)
cell2.from(cell1)

console.log('Initial states:')
console.log('cell1:', getMapValue(cell1.getOutput()))
console.log('cell2:', getMapValue(cell2.getOutput()))

console.log('\nUser input to cell1: 10')
cell1.userInput(num(10))
console.log('cell1:', getMapValue(cell1.getOutput())?.value)
console.log('cell2:', getMapValue(cell2.getOutput())?.value)

console.log('\nUser input to cell2: 20')
cell2.userInput(num(20))
console.log('cell1:', getMapValue(cell1.getOutput())?.value, '(should be 20)')
console.log('cell2:', getMapValue(cell2.getOutput())?.value)

console.log('\nUser input to cell1: 30')
cell1.userInput(num(30))
console.log('cell1:', getMapValue(cell1.getOutput())?.value)
console.log('cell2:', getMapValue(cell2.getOutput())?.value, '(should be 30)')