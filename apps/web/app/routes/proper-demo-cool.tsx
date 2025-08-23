/**
 * Cool demo of proper-bassline showing bidirectional constraints
 * Inspired by atto-demo but using our new propagation protocol
 */

import { useState, useCallback } from 'react'
import { 
  NetworkProvider, 
  useNetwork, 
  useCell, 
  useGadget,
  useWiring,
  useFunctionOutput
} from '~/proper-bassline-integration'
import { Network } from 'proper-bassline/src/network'
import { OrdinalCell, MaxCell, MinCell } from 'proper-bassline/src/cells/basic'
import { FunctionGadget } from 'proper-bassline/src/function'
import { num, str, nil, getMapValue, ordinalValue, getOrdinal } from 'proper-bassline/src/types'
import type { LatticeValue } from 'proper-bassline/src/types'

// ============================================================================
// Temperature Converter with Bidirectional Constraints
// ============================================================================

class CelsiusToFahrenheit extends FunctionGadget {
  constructor(id: string) {
    super(id, ['celsius'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args.celsius
    if (!input) return nil()
    
    // Extract value and ordinal
    const value = getMapValue(input)
    const ordinal = getOrdinal(input)
    
    if (!value || value.type !== 'number') return nil()
    
    const fahrenheit = value.value * 9/5 + 32
    
    // Preserve ordinal for proper propagation
    if (ordinal !== null) {
      return ordinalValue(ordinal, num(fahrenheit))
    }
    return num(fahrenheit)
  }
}

class FahrenheitToCelsius extends FunctionGadget {
  constructor(id: string) {
    super(id, ['fahrenheit'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args.fahrenheit
    if (!input) return nil()
    
    // Extract value and ordinal
    const value = getMapValue(input)
    const ordinal = getOrdinal(input)
    
    if (!value || value.type !== 'number') return nil()
    
    const celsius = (value.value - 32) * 5/9
    
    // Preserve ordinal for proper propagation
    if (ordinal !== null) {
      return ordinalValue(ordinal, num(celsius))
    }
    return num(celsius)
  }
}

function TemperatureConverter() {
  const network = useNetwork()
  
  // Create the temperature cells and converters
  const celsius = useGadget(() => new OrdinalCell('celsius'), 'temp-celsius')
  const fahrenheit = useGadget(() => new OrdinalCell('fahrenheit'), 'temp-fahrenheit')
  const c2f = useGadget(() => new CelsiusToFahrenheit('c2f'), 'temp-c2f')
  const f2c = useGadget(() => new FahrenheitToCelsius('f2c'), 'temp-f2c')
  
  // Wire up bidirectional constraints
  useWiring([
    { from: celsius, to: c2f, toInput: 'celsius' },
    { from: c2f, to: fahrenheit },
    { from: fahrenheit, to: f2c, toInput: 'fahrenheit' },
    { from: f2c, to: celsius }
  ])
  
  const [celsiusValue, setCelsius] = useCell<number>(celsius)
  const [fahrenheitValue, setFahrenheit] = useCell<number>(fahrenheit)
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">🌡️ Temperature Converter</h3>
      <p className="text-sm text-gray-600 mb-4">
        Bidirectional constraints - change either value and the other updates!
      </p>
      
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="w-24 font-medium">Celsius:</label>
          <input
            type="number"
            value={celsiusValue ?? 0}
            onChange={(e) => setCelsius(num(parseFloat(e.target.value) || 0))}
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <span className="text-lg">°C</span>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="w-24 font-medium">Fahrenheit:</label>
          <input
            type="number"
            value={fahrenheitValue ?? 32}
            onChange={(e) => setFahrenheit(num(parseFloat(e.target.value) || 32))}
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <span className="text-lg">°F</span>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
          <div>Freezing: 0°C = 32°F</div>
          <div>Boiling: 100°C = 212°F</div>
          <div>Room temp: ~20°C = ~68°F</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// RGB Color Mixer with Live Preview
// ============================================================================

class ColorMixer extends FunctionGadget {
  constructor(id: string) {
    super(id, ['red', 'green', 'blue'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const red = getMapValue(args.red)
    const green = getMapValue(args.green)
    const blue = getMapValue(args.blue)
    
    const r = red?.type === 'number' ? Math.floor(red.value) : 0
    const g = green?.type === 'number' ? Math.floor(green.value) : 0
    const b = blue?.type === 'number' ? Math.floor(blue.value) : 0
    
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    return str(hex)
  }
}

function ColorMixerComponent() {
  const network = useNetwork()
  
  // Create color channel cells
  const redCell = useGadget(() => new OrdinalCell('red'), 'color-red')
  const greenCell = useGadget(() => new OrdinalCell('green'), 'color-green')
  const blueCell = useGadget(() => new OrdinalCell('blue'), 'color-blue')
  
  // Create the color mixer function
  const mixer = useGadget(() => new ColorMixer('mixer'), 'color-mixer')
  
  // Wire inputs to mixer
  useWiring([
    { from: redCell, to: mixer, toInput: 'red' },
    { from: greenCell, to: mixer, toInput: 'green' },
    { from: blueCell, to: mixer, toInput: 'blue' }
  ])
  
  const [red, setRed] = useCell<number>(redCell)
  const [green, setGreen] = useCell<number>(greenCell)
  const [blue, setBlue] = useCell<number>(blueCell)
  const hexColor = useFunctionOutput<string>(mixer)
  
  // Initialize with a nice color
  if (red === null) setRed(num(100))
  if (green === null) setGreen(num(150))
  if (blue === null) setBlue(num(200))
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">🎨 RGB Color Mixer</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Red: {red ?? 0}
          </label>
          <input
            type="range"
            value={red ?? 0}
            min={0}
            max={255}
            onChange={(e) => setRed(num(parseInt(e.target.value)))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, #000, #ff0000)`
            }}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Green: {green ?? 0}
          </label>
          <input
            type="range"
            value={green ?? 0}
            min={0}
            max={255}
            onChange={(e) => setGreen(num(parseInt(e.target.value)))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, #000, #00ff00)`
            }}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Blue: {blue ?? 0}
          </label>
          <input
            type="range"
            value={blue ?? 0}
            min={0}
            max={255}
            onChange={(e) => setBlue(num(parseInt(e.target.value)))}
            className="w-full"
            style={{
              background: `linear-gradient(to right, #000, #0000ff)`
            }}
          />
        </div>
        
        <div 
          className="h-32 rounded-lg flex items-center justify-center text-white font-mono text-lg shadow-inner"
          style={{
            backgroundColor: hexColor || '#000',
            color: (red ?? 0) + (green ?? 0) + (blue ?? 0) > 380 ? '#000' : '#fff'
          }}
        >
          {hexColor || '#000000'}
        </div>
        
        <div className="text-sm text-gray-600">
          RGB({red ?? 0}, {green ?? 0}, {blue ?? 0})
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Inverse Sliders (Sum always equals 100)
// ============================================================================

class InverseConstraint extends FunctionGadget {
  constructor(id: string) {
    super(id, ['value'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args.value
    if (!input) return num(50)
    
    const value = getMapValue(input)
    const ordinal = getOrdinal(input)
    
    if (!value || value.type !== 'number') return num(50)
    
    const inverted = 100 - value.value
    
    // Preserve ordinal for proper propagation
    if (ordinal !== null) {
      return ordinalValue(ordinal, num(inverted))
    }
    return num(inverted)
  }
}

function InverseSliders() {
  const network = useNetwork()
  
  // Create two sliders with inverse relationship
  const slider1 = useGadget(() => new OrdinalCell('slider1'), 'inverse-slider1')
  const slider2 = useGadget(() => new OrdinalCell('slider2'), 'inverse-slider2')
  
  // Create inverse constraints
  const inverse1 = useGadget(() => new InverseConstraint('inverse1'), 'inverse1')
  const inverse2 = useGadget(() => new InverseConstraint('inverse2'), 'inverse2')
  
  // Wire up the inverse relationship
  useWiring([
    { from: slider1, to: inverse1, toInput: 'value' },
    { from: inverse1, to: slider2 },
    { from: slider2, to: inverse2, toInput: 'value' },
    { from: inverse2, to: slider1 }
  ])
  
  const [value1, setValue1] = useCell<number>(slider1)
  const [value2, setValue2] = useCell<number>(slider2)
  
  // Initialize if needed
  if (value1 === null && value2 === null) {
    setValue1(num(25))
  }
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">⚖️ Inverse Sliders</h3>
      <p className="text-sm text-gray-600 mb-4">
        These sliders are constrained - they always sum to 100!
      </p>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Slider A: {value1 ?? 0}
          </label>
          <input
            type="range"
            value={value1 ?? 0}
            min={0}
            max={100}
            onChange={(e) => setValue1(num(parseInt(e.target.value)))}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Slider B: {value2 ?? 0}
          </label>
          <input
            type="range"
            value={value2 ?? 0}
            min={0}
            max={100}
            onChange={(e) => setValue2(num(parseInt(e.target.value)))}
            className="w-full"
          />
        </div>
        
        <div className="p-4 bg-gray-100 rounded-lg text-center">
          <div className="text-2xl font-bold">
            {(value1 ?? 0)} + {(value2 ?? 0)} = {(value1 ?? 0) + (value2 ?? 0)}
          </div>
          <div className="text-sm text-gray-600 mt-1">Always equals 100!</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Budget Allocator - Amounts and percentages constrained by total
// ============================================================================

// Converts percentage to dollar amount based on total budget
class PercentageToAmount extends FunctionGadget {
  constructor(id: string) {
    super(id, ['percentage', 'total'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args.percentage
    const totalInput = args.total
    
    if (!input || !totalInput) return nil()
    
    const percentage = getMapValue(input)
    const total = getMapValue(totalInput)
    const ordinal = getOrdinal(input)
    
    if (!percentage || percentage.type !== 'number' || !total || total.type !== 'number') return nil()
    
    const amount = (percentage.value / 100) * total.value
    
    if (ordinal !== null) {
      return ordinalValue(ordinal, num(amount))
    }
    return num(amount)
  }
}

// Converts dollar amount to percentage based on total budget
class AmountToPercentage extends FunctionGadget {
  constructor(id: string) {
    super(id, ['amount', 'total'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const input = args.amount
    const totalInput = args.total
    
    if (!input || !totalInput) return nil()
    
    const amount = getMapValue(input)
    const total = getMapValue(totalInput)
    const ordinal = getOrdinal(input)
    
    if (!amount || amount.type !== 'number' || !total || total.type !== 'number') return nil()
    
    const percentage = total.value > 0 ? (amount.value / total.value) * 100 : 0
    
    if (ordinal !== null) {
      return ordinalValue(ordinal, num(percentage))
    }
    return num(percentage)
  }
}

// Sums all the amounts
class SumAmounts extends FunctionGadget {
  constructor(id: string) {
    super(id, ['housing', 'food', 'transport', 'entertainment'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const housing = getMapValue(args.housing)
    const food = getMapValue(args.food)
    const transport = getMapValue(args.transport)
    const entertainment = getMapValue(args.entertainment)
    
    const h = housing?.type === 'number' ? housing.value : 0
    const f = food?.type === 'number' ? food.value : 0
    const t = transport?.type === 'number' ? transport.value : 0
    const e = entertainment?.type === 'number' ? entertainment.value : 0
    
    return num(h + f + t + e)
  }
}

function BudgetAllocator() {
  const network = useNetwork()
  
  // Create the budget network
  const budgetNet = useGadget(() => {
    const budget = new Network('budget')
    
    // Total budget cell (user can set this)
    const totalBudget = new OrdinalCell('totalBudget')
    
    // Percentage cells for each category
    const housingPct = new OrdinalCell('housingPct')
    const foodPct = new OrdinalCell('foodPct')
    const transportPct = new OrdinalCell('transportPct')
    const entertainmentPct = new OrdinalCell('entertainmentPct')
    
    // Amount cells for each category
    const housingAmt = new OrdinalCell('housingAmt')
    const foodAmt = new OrdinalCell('foodAmt')
    const transportAmt = new OrdinalCell('transportAmt')
    const entertainmentAmt = new OrdinalCell('entertainmentAmt')
    
    // Converters between percentages and amounts
    const housingPctToAmt = new PercentageToAmount('housingPctToAmt')
    const housingAmtToPct = new AmountToPercentage('housingAmtToPct')
    
    const foodPctToAmt = new PercentageToAmount('foodPctToAmt')
    const foodAmtToPct = new AmountToPercentage('foodAmtToPct')
    
    const transportPctToAmt = new PercentageToAmount('transportPctToAmt')
    const transportAmtToPct = new AmountToPercentage('transportAmtToPct')
    
    const entertainmentPctToAmt = new PercentageToAmount('entertainmentPctToAmt')
    const entertainmentAmtToPct = new AmountToPercentage('entertainmentAmtToPct')
    
    // Sum calculator
    const sumCalculator = new SumAmounts('sumCalculator')
    
    // Add all gadgets to the network
    budget.add(
      totalBudget,
      housingPct, foodPct, transportPct, entertainmentPct,
      housingAmt, foodAmt, transportAmt, entertainmentAmt,
      housingPctToAmt, housingAmtToPct,
      foodPctToAmt, foodAmtToPct,
      transportPctToAmt, transportAmtToPct,
      entertainmentPctToAmt, entertainmentAmtToPct,
      sumCalculator
    )
    
    // Wire up the bidirectional constraints
    // Housing
    housingPctToAmt.connectFrom('percentage', housingPct)
    housingPctToAmt.connectFrom('total', totalBudget)
    housingAmt.from(housingPctToAmt)
    
    housingAmtToPct.connectFrom('amount', housingAmt)
    housingAmtToPct.connectFrom('total', totalBudget)
    housingPct.from(housingAmtToPct)
    
    // Food
    foodPctToAmt.connectFrom('percentage', foodPct)
    foodPctToAmt.connectFrom('total', totalBudget)
    foodAmt.from(foodPctToAmt)
    
    foodAmtToPct.connectFrom('amount', foodAmt)
    foodAmtToPct.connectFrom('total', totalBudget)
    foodPct.from(foodAmtToPct)
    
    // Transport
    transportPctToAmt.connectFrom('percentage', transportPct)
    transportPctToAmt.connectFrom('total', totalBudget)
    transportAmt.from(transportPctToAmt)
    
    transportAmtToPct.connectFrom('amount', transportAmt)
    transportAmtToPct.connectFrom('total', totalBudget)
    transportPct.from(transportAmtToPct)
    
    // Entertainment
    entertainmentPctToAmt.connectFrom('percentage', entertainmentPct)
    entertainmentPctToAmt.connectFrom('total', totalBudget)
    entertainmentAmt.from(entertainmentPctToAmt)
    
    entertainmentAmtToPct.connectFrom('amount', entertainmentAmt)
    entertainmentAmtToPct.connectFrom('total', totalBudget)
    entertainmentPct.from(entertainmentAmtToPct)
    
    // Wire amounts to sum calculator
    sumCalculator.connectFrom('housing', housingAmt)
    sumCalculator.connectFrom('food', foodAmt)
    sumCalculator.connectFrom('transport', transportAmt)
    sumCalculator.connectFrom('entertainment', entertainmentAmt)
    
    return budget
  }, 'budget-network')
  
  // Get references to the cells
  const totalBudget = budgetNet.getByPath('totalBudget') as OrdinalCell
  const housingPct = budgetNet.getByPath('housingPct') as OrdinalCell
  const foodPct = budgetNet.getByPath('foodPct') as OrdinalCell
  const transportPct = budgetNet.getByPath('transportPct') as OrdinalCell
  const entertainmentPct = budgetNet.getByPath('entertainmentPct') as OrdinalCell
  
  const housingAmt = budgetNet.getByPath('housingAmt') as OrdinalCell
  const foodAmt = budgetNet.getByPath('foodAmt') as OrdinalCell
  const transportAmt = budgetNet.getByPath('transportAmt') as OrdinalCell
  const entertainmentAmt = budgetNet.getByPath('entertainmentAmt') as OrdinalCell
  
  const sumCalculator = budgetNet.getByPath('sumCalculator') as FunctionGadget
  
  // Use cells for state
  const [totalBudgetVal, setTotalBudget] = useCell<number>(totalBudget)
  
  const [housingPctVal, setHousingPct] = useCell<number>(housingPct)
  const [foodPctVal, setFoodPct] = useCell<number>(foodPct)
  const [transportPctVal, setTransportPct] = useCell<number>(transportPct)
  const [entertainmentPctVal, setEntertainmentPct] = useCell<number>(entertainmentPct)
  
  const [housingAmtVal, setHousingAmt] = useCell<number>(housingAmt)
  const [foodAmtVal, setFoodAmt] = useCell<number>(foodAmt)
  const [transportAmtVal, setTransportAmt] = useCell<number>(transportAmt)
  const [entertainmentAmtVal, setEntertainmentAmt] = useCell<number>(entertainmentAmt)
  
  const totalSpent = useFunctionOutput<number>(sumCalculator)
  
  // Initialize with defaults
  if (totalBudgetVal === null) setTotalBudget(num(5000))
  if (housingPctVal === null) setHousingPct(num(35))
  if (foodPctVal === null) setFoodPct(num(25))
  if (transportPctVal === null) setTransportPct(num(20))
  if (entertainmentPctVal === null) setEntertainmentPct(num(20))
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">💰 Budget Allocator</h3>
      <p className="text-sm text-gray-600 mb-4">
        Adjust percentages OR dollar amounts - they stay in sync!
      </p>
      
      {/* Total Budget */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <label className="block text-sm font-medium mb-2">
          Total Monthly Budget: ${totalBudgetVal ?? 5000}
        </label>
        <input
          type="range"
          value={totalBudgetVal ?? 5000}
          min={1000}
          max={10000}
          step={100}
          onChange={(e) => setTotalBudget(num(parseInt(e.target.value)))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>$1,000</span>
          <span>$10,000</span>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Housing */}
        <div className="p-3 border rounded-lg">
          <h4 className="font-medium mb-3">🏠 Housing</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Percentage: {Math.round(housingPctVal ?? 35)}%</label>
              <input
                type="range"
                value={housingPctVal ?? 35}
                min={0}
                max={100}
                onChange={(e) => setHousingPct(num(parseInt(e.target.value)))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Amount: ${Math.round(housingAmtVal ?? 0)}</label>
              <input
                type="range"
                value={housingAmtVal ?? 0}
                min={0}
                max={totalBudgetVal ?? 5000}
                step={10}
                onChange={(e) => setHousingAmt(num(parseInt(e.target.value)))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
        {/* Food */}
        <div className="p-3 border rounded-lg">
          <h4 className="font-medium mb-3">🍔 Food</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Percentage: {Math.round(foodPctVal ?? 25)}%</label>
              <input
                type="range"
                value={foodPctVal ?? 25}
                min={0}
                max={100}
                onChange={(e) => setFoodPct(num(parseInt(e.target.value)))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Amount: ${Math.round(foodAmtVal ?? 0)}</label>
              <input
                type="range"
                value={foodAmtVal ?? 0}
                min={0}
                max={totalBudgetVal ?? 5000}
                step={10}
                onChange={(e) => setFoodAmt(num(parseInt(e.target.value)))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
        {/* Transport */}
        <div className="p-3 border rounded-lg">
          <h4 className="font-medium mb-3">🚗 Transport</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Percentage: {Math.round(transportPctVal ?? 20)}%</label>
              <input
                type="range"
                value={transportPctVal ?? 20}
                min={0}
                max={100}
                onChange={(e) => setTransportPct(num(parseInt(e.target.value)))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Amount: ${Math.round(transportAmtVal ?? 0)}</label>
              <input
                type="range"
                value={transportAmtVal ?? 0}
                min={0}
                max={totalBudgetVal ?? 5000}
                step={10}
                onChange={(e) => setTransportAmt(num(parseInt(e.target.value)))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
        {/* Entertainment */}
        <div className="p-3 border rounded-lg">
          <h4 className="font-medium mb-3">🎮 Entertainment</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Percentage: {Math.round(entertainmentPctVal ?? 20)}%</label>
              <input
                type="range"
                value={entertainmentPctVal ?? 20}
                min={0}
                max={100}
                onChange={(e) => setEntertainmentPct(num(parseInt(e.target.value)))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Amount: ${Math.round(entertainmentAmtVal ?? 0)}</label>
              <input
                type="range"
                value={entertainmentAmtVal ?? 0}
                min={0}
                max={totalBudgetVal ?? 5000}
                step={10}
                onChange={(e) => setEntertainmentAmt(num(parseInt(e.target.value)))}
                className="w-full"
              />
            </div>
          </div>
        </div>
        
        {/* Summary */}
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <div className="text-lg font-semibold mb-2">
            Total Spent: ${Math.round(totalSpent ?? 0)} / ${totalBudgetVal ?? 5000}
          </div>
          <div className="w-full bg-gray-300 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{
                width: `${Math.min(100, ((totalSpent ?? 0) / (totalBudgetVal ?? 5000)) * 100)}%`,
                backgroundColor: (totalSpent ?? 0) > (totalBudgetVal ?? 5000) ? '#ef4444' : '#2563eb'
              }}
            />
          </div>
          <div className="mt-2 text-sm">
            {(totalSpent ?? 0) > (totalBudgetVal ?? 5000) && 
              <span className="text-red-600 font-medium">⚠️ Over budget by ${Math.round((totalSpent ?? 0) - (totalBudgetVal ?? 5000))}</span>
            }
            {(totalSpent ?? 0) <= (totalBudgetVal ?? 5000) && 
              <span className="text-green-600 font-medium">✓ Within budget (${Math.round((totalBudgetVal ?? 5000) - (totalSpent ?? 0))} remaining)</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Demo App
// ============================================================================

export default function ProperDemoCool() {
  const [mainNetwork] = useState(() => new Network('main'))
  const [activeDemo, setActiveDemo] = useState<'temp' | 'color' | 'inverse' | 'budget'>('temp')
  
  return (
    <NetworkProvider network={mainNetwork}>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto p-8 max-w-6xl">
          <h1 className="text-4xl font-bold mb-2">✨ Proper Bassline: Cool Demos</h1>
          <p className="text-gray-600 mb-8">
            Bidirectional constraints and propagation networks in action
          </p>
          
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setActiveDemo('temp')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeDemo === 'temp' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              🌡️ Temperature
            </button>
            <button
              onClick={() => setActiveDemo('color')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeDemo === 'color' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              🎨 Color Mixer
            </button>
            <button
              onClick={() => setActiveDemo('inverse')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeDemo === 'inverse' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              ⚖️ Inverse Sliders
            </button>
            <button
              onClick={() => setActiveDemo('budget')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                activeDemo === 'budget' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              💰 Budget
            </button>
          </div>
          
          {/* Demo Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {activeDemo === 'temp' && (
              <>
                <TemperatureConverter />
                <div className="p-6 bg-blue-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">How it works:</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Two OrdinalCells track Celsius and Fahrenheit values</li>
                    <li>• FunctionGadgets convert between the units</li>
                    <li>• Bidirectional wiring creates a constraint system</li>
                    <li>• Changes to either value propagate through the network</li>
                    <li>• OrdinalCell's "last write wins" prevents loops</li>
                  </ul>
                </div>
              </>
            )}
            
            {activeDemo === 'color' && (
              <>
                <ColorMixerComponent />
                <div className="p-6 bg-purple-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">How it works:</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Three OrdinalCells for RGB color channels</li>
                    <li>• ColorMixer FunctionGadget combines the values</li>
                    <li>• Outputs a hex color string</li>
                    <li>• Live preview updates as you adjust sliders</li>
                    <li>• Demonstrates many-to-one data flow</li>
                  </ul>
                </div>
              </>
            )}
            
            {activeDemo === 'inverse' && (
              <>
                <InverseSliders />
                <div className="p-6 bg-green-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">How it works:</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Two sliders with an inverse constraint</li>
                    <li>• InverseConstraint gadget computes 100 - value</li>
                    <li>• Bidirectional wiring maintains the constraint</li>
                    <li>• Moving one slider automatically adjusts the other</li>
                    <li>• The sum always equals 100</li>
                  </ul>
                </div>
              </>
            )}
            
            {activeDemo === 'budget' && (
              <>
                <BudgetAllocator />
                <div className="p-6 bg-yellow-50 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3">How it works:</h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Four OrdinalCells for budget categories</li>
                    <li>• Values can exceed 100% individually</li>
                    <li>• Display shows normalized percentages</li>
                    <li>• Demonstrates proportional constraints</li>
                    <li>• Could be extended with a normalizer gadget</li>
                  </ul>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-12 p-6 bg-gray-100 rounded-lg">
            <h3 className="font-semibold mb-2">🚀 Key Features Demonstrated:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">Bidirectional Constraints</h4>
                <p className="text-gray-600">Changes flow both ways through connections, maintaining relationships</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Propagation Protocol</h4>
                <p className="text-gray-600">Gadgets handle their own accept/emit behavior locally</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Semi-Lattice Operations</h4>
                <p className="text-gray-600">OrdinalCell uses "last write wins" to prevent loops</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">React Integration</h4>
                <p className="text-gray-600">Gadgets as state management with automatic updates</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NetworkProvider>
  )
}