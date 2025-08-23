import { OrdinalCell } from './src/cells/basic'
import { num, ordinalValue, getMapValue } from './src/types'

console.log('=== Debug Propagation Protocol ===\n')

const cell1 = new OrdinalCell('cell1')
const cell2 = new OrdinalCell('cell2')

// Connect cell2 to receive from cell1
console.log('Connecting cell2 from cell1...')
cell2.from(cell1)

console.log('\nInitial states:')
console.log('cell1:', cell1.getOutput())
console.log('cell2:', cell2.getOutput())

console.log('\nSetting cell1 to ordinal 1, value 42...')
cell1.setOutput('default', ordinalValue(1, num(42)))

console.log('\nAfter setting cell1:')
console.log('cell1:', getMapValue(cell1.getOutput()))
console.log('cell2:', getMapValue(cell2.getOutput()))

console.log('\nChecking downstream connections:')
console.log('cell1 downstream count:', cell1.downstream.size)
console.log('cell2 downstream count:', cell2.downstream.size)