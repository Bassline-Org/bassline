/**
 * Calculator Application Template
 * A simple calculator app that can run in the desktop environment
 */

import { primitive, onAny, type PrimitiveTemplate } from './templates-v2'

// Calculator state
interface CalculatorState {
  display: string
  previousValue: number | null
  operation: string | null
  waitingForOperand: boolean
  history: string[]
}

// Global calculator states
const calculatorStates = new Map<string, CalculatorState>()

function getOrCreateCalculatorState(gadgetId: string): CalculatorState {
  if (!calculatorStates.has(gadgetId)) {
    calculatorStates.set(gadgetId, {
      display: '0',
      previousValue: null,
      operation: null,
      waitingForOperand: false,
      history: []
    })
  }
  return calculatorStates.get(gadgetId)!
}

function performCalculation(prev: number, current: number, operation: string): number {
  switch (operation) {
    case '+': return prev + current
    case '-': return prev - current
    case '*': return prev * current
    case '/': return current !== 0 ? prev / current : 0
    case '=': return current
    default: return current
  }
}

/**
 * Calculator Application Template
 */
export const CalculatorTemplate: PrimitiveTemplate = primitive(
  {
    inputs: {
      // Button inputs
      numberPressed: { type: 'string', default: '' }, // '0'-'9'
      operatorPressed: { type: 'string', default: '' }, // '+', '-', '*', '/', '='
      functionPressed: { type: 'string', default: '' }, // 'clear', 'backspace', 'decimal'
      
      // Direct value input (for external connections)
      setValue: { type: 'number', default: null },
      
      // Application lifecycle
      appVisible: { type: 'boolean', default: true },
      appFocused: { type: 'boolean', default: false },
    },
    outputs: {
      // Current state
      displayValue: { type: 'string' },
      numericValue: { type: 'number' },
      
      // Events
      calculationPerformed: { type: 'object' }, // { operation, result, expression }
      
      // Application state
      appTitle: { type: 'string' },
      appReady: { type: 'boolean' },
      
      // History
      calculationHistory: { type: 'array' },
    }
  },
  (inputs) => {
    const instanceId = 'calculator-instance' // Could be made dynamic
    const state = getOrCreateCalculatorState(instanceId)
    
    let calculationPerformed = null
    
    console.log('Calculator compute called with inputs:', inputs)
    
    // Handle number input
    if (inputs.numberPressed && /^[0-9]$/.test(inputs.numberPressed)) {
      const number = inputs.numberPressed
      
      if (state.waitingForOperand) {
        state.display = number
        state.waitingForOperand = false
      } else {
        state.display = state.display === '0' ? number : state.display + number
      }
    }
    
    // Handle decimal point
    if (inputs.functionPressed === 'decimal') {
      if (state.waitingForOperand) {
        state.display = '0.'
        state.waitingForOperand = false
      } else if (state.display.indexOf('.') === -1) {
        state.display += '.'
      }
    }
    
    // Handle operators
    if (inputs.operatorPressed && /^[+\-*/=]$/.test(inputs.operatorPressed)) {
      const currentValue = parseFloat(state.display)
      
      if (state.previousValue === null) {
        state.previousValue = currentValue
      } else if (state.operation) {
        const result = performCalculation(state.previousValue, currentValue, state.operation)
        const expression = `${state.previousValue} ${state.operation} ${currentValue} = ${result}`
        
        state.display = String(result)
        state.previousValue = result
        state.history.push(expression)
        
        calculationPerformed = {
          operation: state.operation,
          result,
          expression
        } as any
        
        console.log('Calculator: Performed calculation:', expression)
      }
      
      state.waitingForOperand = true
      state.operation = inputs.operatorPressed === '=' ? null : inputs.operatorPressed
      
      if (inputs.operatorPressed === '=') {
        state.previousValue = null
      }
    }
    
    // Handle function keys
    if (inputs.functionPressed === 'clear') {
      state.display = '0'
      state.previousValue = null
      state.operation = null
      state.waitingForOperand = false
    } else if (inputs.functionPressed === 'backspace') {
      if (state.display.length > 1) {
        state.display = state.display.slice(0, -1)
      } else {
        state.display = '0'
      }
    }
    
    // Handle direct value setting (for external connections)
    if (inputs.setValue !== null && typeof inputs.setValue === 'number') {
      state.display = String(inputs.setValue)
      state.previousValue = null
      state.operation = null
      state.waitingForOperand = false
    }
    
    // Keep history manageable
    if (state.history.length > 10) {
      state.history = state.history.slice(-10)
    }
    
    return {
      displayValue: state.display,
      numericValue: parseFloat(state.display) || 0,
      calculationPerformed,
      appTitle: 'Calculator',
      appReady: true,
      calculationHistory: [...state.history]
    }
  },
  'Calculator application for basic arithmetic',
  {
    // Activate on any button press or value change
    activate: onAny(['numberPressed', 'operatorPressed', 'functionPressed', 'setValue'])
  }
)