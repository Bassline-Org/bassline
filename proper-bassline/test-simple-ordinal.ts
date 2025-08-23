import { OrdinalCell } from './src/cells/basic'
import { num, ordinalValue, getMapValue, getOrdinal } from './src/types'

const cell = new OrdinalCell('test')

console.log('Test: accept with increasing ordinals')

console.log('\n1. Accept ordinal 1, value 10:')
cell.accept(ordinalValue(1, num(10)), cell)
console.log('  Result: value=' + getMapValue(cell.getOutput())?.value + ', ordinal=' + getOrdinal(cell.getOutput()))

console.log('\n2. Accept ordinal 2, value 20:')
cell.accept(ordinalValue(2, num(20)), cell)
console.log('  Result: value=' + getMapValue(cell.getOutput())?.value + ', ordinal=' + getOrdinal(cell.getOutput()))

console.log('\n3. Accept ordinal 1, value 30 (lower ordinal):')
cell.accept(ordinalValue(1, num(30)), cell)
console.log('  Result: value=' + getMapValue(cell.getOutput())?.value + ', ordinal=' + getOrdinal(cell.getOutput()))