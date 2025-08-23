import { OrdinalCell } from './src/cells/basic'
import { ordinalValue, num, getMapValue, isNumber } from './src/types'

const cell = new OrdinalCell('test')

// Set a value
cell.setOutput('default', ordinalValue(1, num(10)))
console.log('Before compute:', cell.getOutput())

// Compute
cell.compute()
console.log('After compute:', cell.getOutput())

// Get the value
const output = cell.getOutput()
console.log('Output type:', output.type)
if (output.type === 'map') {
  console.log('Map entries:', Array.from(output.value.entries()))
}

const value = getMapValue(output)
console.log('Extracted value:', value)
console.log('Is number?', isNumber(value))