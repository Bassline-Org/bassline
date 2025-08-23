/**
 * Test OrdinalCell and bidirectional constraints
 */

import { describe, it, expect } from 'vitest'
import { Network } from '../src/network'
import { OrdinalCell } from '../src/cells/basic'
import { FunctionGadget } from '../src/function'
import { num, isNumber, ordinalValue, getOrdinal, getMapValue } from '../src/types'
import type { LatticeValue } from '../src/types'

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

describe('OrdinalCell', () => {
  it('should handle ordinal values correctly', () => {
    const cell = new OrdinalCell('test')
    const network = new Network('test-net')
    network.add(cell)
    
    // Set initial value with ordinal 1
    cell.setOutput('default', ordinalValue(1, num(10)))
    cell.compute()
    
    // OrdinalCell should return the full ordinal map
    const output = cell.getOutput()
    const value = getMapValue(output)
    expect(isNumber(value)).toBe(true)
    expect(value?.value).toBe(10)
  })
  
  it('should keep the value with highest ordinal', () => {
    const cell = new OrdinalCell('test')
    const source1 = new OrdinalCell('source1')
    const source2 = new OrdinalCell('source2')
    
    const network = new Network('test-net')
    network.add(cell, source1, source2)
    
    // Connect sources to cell
    cell.from(source1, source2)
    
    // Set values with different ordinals
    source1.setOutput('default', ordinalValue(1, num(10)))
    source2.setOutput('default', ordinalValue(2, num(20)))
    
    // Propagate
    network.propagate()
    
    const output = getMapValue(cell.getOutput())
    expect(isNumber(output)).toBe(true)
    expect(output?.value).toBe(20) // Should be value with ordinal 2
    
    // Now update source1 with higher ordinal
    source1.setOutput('default', ordinalValue(3, num(30)))
    network.propagate()
    
    const newOutput = getMapValue(cell.getOutput())
    expect(isNumber(newOutput)).toBe(true)
    expect(newOutput?.value).toBe(30) // Should be value with ordinal 3
  })
})

describe('Bidirectional Temperature Converter', () => {
  it('should convert celsius to fahrenheit', () => {
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
    
    // Set celsius to 0
    celsius.setOutput('default', ordinalValue(1, num(0)))
    network.propagate()
    
    const fahrenheitValue = getMapValue(fahrenheit.getOutput())
    expect(isNumber(fahrenheitValue)).toBe(true)
    expect(fahrenheitValue?.value).toBe(32)
  })
  
  it('should convert fahrenheit to celsius', () => {
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
    
    // Set fahrenheit to 212
    fahrenheit.setOutput('default', ordinalValue(1, num(212)))
    network.propagate()
    
    const celsiusValue = getMapValue(celsius.getOutput())
    expect(isNumber(celsiusValue)).toBe(true)
    expect(celsiusValue?.value).toBe(100)
  })
  
  it('should handle bidirectional updates without infinite loops', () => {
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
    
    // Update celsius
    celsius.setOutput('default', ordinalValue(1, num(100)))
    network.propagate()
    
    // Check fahrenheit
    let fahrenheitValue = getMapValue(fahrenheit.getOutput())
    expect(isNumber(fahrenheitValue)).toBe(true)
    expect(fahrenheitValue?.value).toBe(212)
    
    // Now update fahrenheit with higher ordinal
    fahrenheit.setOutput('default', ordinalValue(2, num(32)))
    network.propagate()
    
    // Check celsius - should still be 100 because it has lower ordinal
    // The fahrenheit update will propagate but celsius keeps its value
    let celsiusValue = getMapValue(celsius.getOutput())
    expect(isNumber(celsiusValue)).toBe(true)
    expect(celsiusValue?.value).toBe(100)
    
    // Check fahrenheit is now 32
    fahrenheitValue = getMapValue(fahrenheit.getOutput())
    expect(isNumber(fahrenheitValue)).toBe(true)
    expect(fahrenheitValue?.value).toBe(32)
    
    // Update celsius again with even higher ordinal
    celsius.setOutput('default', ordinalValue(3, num(50)))
    network.propagate()
    
    // Check fahrenheit
    fahrenheitValue = getMapValue(fahrenheit.getOutput())
    expect(isNumber(fahrenheitValue)).toBe(true)
    expect(fahrenheitValue?.value).toBe(122)
  })
})