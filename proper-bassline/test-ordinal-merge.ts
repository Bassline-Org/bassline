import { OrdinalCell } from './src/cells/basic'
import { ordinalValue, num, getMapValue } from './src/types'

const cell = new OrdinalCell('test')
const source = new OrdinalCell('source')

// Connect source to cell
cell.from(source)

// Set cell's initial value with ordinal 1
cell.setOutput('default', ordinalValue(1, num(100)))
cell.compute()
console.log('After setting cell to ordinal 1, value 100:', getMapValue(cell.getOutput()))

// Set source with ordinal 2
source.setOutput('default', ordinalValue(2, num(200)))
source.compute()
console.log('Source output:', source.getOutput())

// Now compute cell - it should take ordinal 2
cell.compute()
console.log('After compute, cell should have ordinal 2:', cell.getOutput())
console.log('Cell value:', getMapValue(cell.getOutput()))