import { OrdinalCell } from './src/cells/basic'
import { num, ordinalValue } from './src/types'

const cell = new OrdinalCell('test')

const val1 = ordinalValue(1, num(10))
const val2 = ordinalValue(2, num(20))

console.log('Testing latticeOp directly:')
console.log('val1:', val1)
console.log('val2:', val2)

const result = cell.latticeOp(val1, val2)
console.log('latticeOp(val1, val2):', result)