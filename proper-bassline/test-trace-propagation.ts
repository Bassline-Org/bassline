import { Network } from './src/network'
import { OrdinalCell } from './src/cells/basic'
import { FunctionGadget } from './src/function'
import { Gadget } from './src/gadget'
import { num, isNumber, ordinalValue, getOrdinal, getMapValue } from './src/types'
import type { LatticeValue } from './src/types'

// Add logging to Gadget methods
const originalEmit = Gadget.prototype.emit
Gadget.prototype.emit = function(outputName: string = "default") {
  console.log(`  [${this.id}].emit(${outputName}): ${JSON.stringify(this.getOutput(outputName))}`)
  originalEmit.call(this, outputName)
}

const originalAccept = Gadget.prototype.accept
Gadget.prototype.accept = function(value: LatticeValue, source: Gadget, inputName?: string) {
  console.log(`  [${this.id}].accept(${inputName || 'default'}) from [${source.id}]: ${JSON.stringify(value)}`)
  if (originalAccept) {
    originalAccept.call(this, value, source, inputName)
  }
}

// Celsius to Fahrenheit function
class CelsiusToFahrenheit extends FunctionGadget {
  constructor(id: string) {
    super(id, ['celsius'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    console.log(`  [${this.id}].fn() called with:`, args)
    const input = args.celsius
    const value = getMapValue(input)
    if (!isNumber(value)) {
      console.log(`  [${this.id}].fn() returning null`)
      return { type: 'null' }
    }
    
    const result = ordinalValue(
      getOrdinal(input) || 0,
      num(value.value * 9/5 + 32)
    )
    console.log(`  [${this.id}].fn() returning:`, result)
    return result
  }
}

console.log('=== Tracing Propagation Protocol ===\n')

const network = new Network('temp-net')
const celsius = new OrdinalCell('celsius')
const fahrenheit = new OrdinalCell('fahrenheit')
const c2f = new CelsiusToFahrenheit('c2f')

network.add(celsius, fahrenheit, c2f)

// Wire: celsius -> c2f -> fahrenheit
console.log('Connecting c2f from celsius...')
c2f.connectFrom('celsius', celsius)

console.log('\nConnecting fahrenheit from c2f...')
fahrenheit.from(c2f)

console.log('\n=== Setting celsius to ordinal 1, value 0 ===')
celsius.setOutput('default', ordinalValue(1, num(0)))

console.log('\nFinal states:')
console.log('celsius:', celsius.getOutput())
console.log('c2f:', c2f.getOutput())
console.log('fahrenheit:', fahrenheit.getOutput())