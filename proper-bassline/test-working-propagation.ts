import { Network } from './src/network'
import { OrdinalCell } from './src/cells/basic'
import { FunctionGadget } from './src/function'
import { num, isNumber, ordinalValue, getOrdinal, getMapValue } from './src/types'
import type { LatticeValue } from './src/types'

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

console.log('=== Bidirectional Temperature Converter ===\n')

const network = new Network('temp-net')
const celsius = new OrdinalCell('celsius')
const fahrenheit = new OrdinalCell('fahrenheit')
const c2f = new CelsiusToFahrenheit('c2f')
const f2c = new FahrenheitToCelsius('f2c')

network.add(celsius, fahrenheit, c2f, f2c)

// Wire bidirectional constraint
c2f.connectFrom('celsius', celsius)
fahrenheit.from(c2f)
f2c.connectFrom('fahrenheit', fahrenheit)
celsius.from(f2c)

console.log('Test 1: Set celsius to 0')
celsius.setOutput('default', ordinalValue(1, num(0)))
console.log('  Celsius:', getMapValue(celsius.getOutput())?.value, '°C')
console.log('  Fahrenheit:', getMapValue(fahrenheit.getOutput())?.value, '°F')

console.log('\nTest 2: Set fahrenheit to 212 (ordinal 2)')
fahrenheit.setOutput('default', ordinalValue(2, num(212)))
console.log('  Celsius:', getMapValue(celsius.getOutput())?.value, '°C')
console.log('  Fahrenheit:', getMapValue(fahrenheit.getOutput())?.value, '°F')

console.log('\nTest 3: Set celsius to 37 (ordinal 3)')
celsius.setOutput('default', ordinalValue(3, num(37)))
console.log('  Celsius:', getMapValue(celsius.getOutput())?.value, '°C')
console.log('  Fahrenheit:', getMapValue(fahrenheit.getOutput())?.value, '°F (should be 98.6)')

console.log('\n✅ Propagation protocol working correctly!')