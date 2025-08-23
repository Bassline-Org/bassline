import { OrdinalCell } from './src/cells/basic'
import { Gadget } from './src/gadget'
import { num, ordinalValue, getMapValue, getOrdinal } from './src/types'

// Override setOutput to see what's happening
const OriginalOrdinalCell = OrdinalCell
class DebugOrdinalCell extends OriginalOrdinalCell {
  protected setOutput(name: string, value: any, autoEmit: boolean = true): void {
    console.log(`  setOutput(${name}, ordinal=${getOrdinal(value)}, value=${getMapValue(value)?.value}, autoEmit=${autoEmit})`)
    const current = this.outputs.get(name)
    if (current) {
      console.log(`    current ordinal=${getOrdinal(current)}, new ordinal=${getOrdinal(value)}`)
      console.log(`    JSON equal? ${JSON.stringify(current) === JSON.stringify(value)}`)
    } else {
      console.log(`    no current value`)
    }
    super.setOutput(name, value, autoEmit)
    console.log(`    after setOutput: ordinal=${getOrdinal(this.outputs.get(name))}`)
  }
}

const cell = new DebugOrdinalCell('test')

console.log('1. Accept ordinal 1, value 10:')
cell.accept(ordinalValue(1, num(10)), cell)
console.log('  Result: ordinal=' + getOrdinal(cell.getOutput()) + ', value=' + getMapValue(cell.getOutput())?.value)

console.log('\n2. Accept ordinal 2, value 20:')
cell.accept(ordinalValue(2, num(20)), cell)
console.log('  Result: ordinal=' + getOrdinal(cell.getOutput()) + ', value=' + getMapValue(cell.getOutput())?.value)