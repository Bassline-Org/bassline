import { OrdinalCell } from './src/cells/basic'
import { Gadget } from './src/gadget'
import { num, getMapValue, getOrdinal } from './src/types'
import type { LatticeValue } from './src/types'

// Add logging to track propagation
const originalAccept = Gadget.prototype.accept
Gadget.prototype.accept = function(value: LatticeValue, source: Gadget, inputName?: string) {
  const ordinal = getOrdinal(value)
  const mapVal = getMapValue(value)
  console.log(`  [${this.id}].accept from [${source.id}]: ordinal=${ordinal}, value=${mapVal?.value || JSON.stringify(value)}`)
  originalAccept.call(this, value, source, inputName)
}

const originalEmit = Gadget.prototype.emit
Gadget.prototype.emit = function(outputName: string = "default") {
  const value = this.getOutput(outputName)
  const ordinal = getOrdinal(value)
  const mapVal = getMapValue(value)
  console.log(`  [${this.id}].emit: ordinal=${ordinal}, value=${mapVal?.value || JSON.stringify(value)}`)
  originalEmit.call(this, outputName)
}

// Test simple bidirectional connection
const cell1 = new OrdinalCell('cell1')
const cell2 = new OrdinalCell('cell2')

console.log('Connecting bidirectionally...')
cell1.from(cell2)
cell2.from(cell1)

console.log('\n=== User input to cell1: 10 ===')
cell1.userInput(num(10))
console.log('Result: cell1=' + getMapValue(cell1.getOutput())?.value + ', cell2=' + getMapValue(cell2.getOutput())?.value)

console.log('\n=== User input to cell2: 20 ===')
cell2.userInput(num(20))
console.log('Result: cell1=' + getMapValue(cell1.getOutput())?.value + ', cell2=' + getMapValue(cell2.getOutput())?.value)