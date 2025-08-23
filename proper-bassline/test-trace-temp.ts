import { Network } from './src/network'
import { OrdinalCell } from './src/cells/basic'
import { FunctionGadget } from './src/function'
import { Gadget } from './src/gadget'
import { num, isNumber, ordinalValue, getOrdinal, getMapValue } from './src/types'
import type { LatticeValue } from './src/types'

// Trace all accept/emit calls
const originalAccept = Gadget.prototype.accept
Gadget.prototype.accept = function(value: LatticeValue, source: Gadget, inputName?: string) {
  const ordinal = getOrdinal(value)
  const mapVal = getMapValue(value)
  console.log(`  [${this.id}].accept from [${source.id}]: ordinal=${ordinal}, value=${mapVal?.value !== undefined ? mapVal.value : JSON.stringify(value).substring(0, 50)}`)
  originalAccept.call(this, value, source, inputName)
}

// Celsius to Fahrenheit function
class CelsiusToFahrenheit extends FunctionGadget {
  constructor(id: string) {
    super(id, ['celsius'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args.celsius
    const value = getMapValue(input)
    if (!isNumber(value)) return { type: 'null' }
    
    return ordinalValue(
      getOrdinal(input) || 0,
      num(value.value * 9/5 + 32)
    )
  }
}

// Fahrenheit to Celsius function  
class FahrenheitToCelsius extends FunctionGadget {
  constructor(id: string) {
    super(id, ['fahrenheit'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args.fahrenheit
    const value = getMapValue(input)
    if (!isNumber(value)) return { type: 'null' }
    
    return ordinalValue(
      getOrdinal(input) || 0,
      num((value.value - 32) * 5/9)
    )
  }
}

console.log('=== Tracing Temperature Converter ===\n')

const network = new Network('temp-net')
const celsius = new OrdinalCell('celsius')
const fahrenheit = new OrdinalCell('fahrenheit')
const c2f = new CelsiusToFahrenheit('c2f')
const f2c = new FahrenheitToCelsius('f2c')

network.add(celsius, fahrenheit, c2f, f2c)

// Wire bidirectional constraint
console.log('Wiring connections...')
c2f.connectFrom('celsius', celsius)
fahrenheit.from(c2f)
f2c.connectFrom('fahrenheit', fahrenheit)
celsius.from(f2c)

console.log('\nTest 1: User sets celsius to 0')
celsius.userInput(num(0))
console.log('Results: C=' + getMapValue(celsius.getOutput())?.value + ' (ord=' + getOrdinal(celsius.getOutput()) + '), F=' + getMapValue(fahrenheit.getOutput())?.value + ' (ord=' + getOrdinal(fahrenheit.getOutput()) + ')')

console.log('\nTest 2: User sets fahrenheit to 212')
console.log('Before userInput: fahrenheit ordinal =', getOrdinal(fahrenheit.getOutput()))
fahrenheit.userInput(num(212))
console.log('After userInput: fahrenheit ordinal =', getOrdinal(fahrenheit.getOutput()))
console.log('Results: C=' + getMapValue(celsius.getOutput())?.value + ' (ord=' + getOrdinal(celsius.getOutput()) + '), F=' + getMapValue(fahrenheit.getOutput())?.value + ' (ord=' + getOrdinal(fahrenheit.getOutput()) + ')')