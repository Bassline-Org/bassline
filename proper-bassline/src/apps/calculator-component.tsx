/**
 * Calculator React Component
 */

import React, { useState, useEffect } from 'react'
import { useGadget, useGadgetOutput, NetworkProvider } from '../react-integration'
import { CalculatorStateMachine } from './calculator'
import { Network } from '../network'
import { isNumber } from '../types'

interface CalculatorProps {
  network?: Network
}

function CalculatorDisplay({ calculator }: { calculator: CalculatorStateMachine }) {
  const displayValue = useGadgetOutput(calculator.display)
  
  const value = displayValue && isNumber(displayValue) ? displayValue.value : 0
  
  return (
    <div className="bg-gray-800 text-white p-4 text-right text-2xl font-mono rounded mb-2">
      {value}
    </div>
  )
}

function CalculatorButtons({ calculator, network }: { calculator: CalculatorStateMachine, network: Network }) {
  const handleDigit = (digit: number) => {
    calculator.enterNumber(digit)
    network.propagate()
  }
  
  const handleOperation = (op: '+' | '-' | '*' | '/') => {
    calculator.setOperation(op)
    network.propagate()
  }
  
  const handleEquals = () => {
    calculator.equals()
    network.propagate()
  }
  
  const handleClear = () => {
    calculator.clear()
    network.propagate()
  }
  
  const handleMemory = (op: 'store' | 'recall' | 'clear') => {
    switch (op) {
      case 'store':
        calculator.memoryStore()
        break
      case 'recall':
        calculator.memoryRecall()
        break
      case 'clear':
        calculator.memoryClear()
        break
    }
    network.propagate()
  }
  
  const buttonClass = "p-4 text-lg font-semibold rounded hover:bg-opacity-80 transition-colors"
  const digitClass = `${buttonClass} bg-gray-600 text-white`
  const opClass = `${buttonClass} bg-blue-600 text-white`
  const memClass = `${buttonClass} bg-green-600 text-white`
  const clearClass = `${buttonClass} bg-red-600 text-white`
  
  return (
    <div className="grid grid-cols-4 gap-2">
      {/* Memory row */}
      <button onClick={() => handleMemory('clear')} className={memClass}>MC</button>
      <button onClick={() => handleMemory('recall')} className={memClass}>MR</button>
      <button onClick={() => handleMemory('store')} className={memClass}>MS</button>
      <button onClick={handleClear} className={clearClass}>C</button>
      
      {/* Digits and operations */}
      <button onClick={() => handleDigit(7)} className={digitClass}>7</button>
      <button onClick={() => handleDigit(8)} className={digitClass}>8</button>
      <button onClick={() => handleDigit(9)} className={digitClass}>9</button>
      <button onClick={() => handleOperation('/')} className={opClass}>÷</button>
      
      <button onClick={() => handleDigit(4)} className={digitClass}>4</button>
      <button onClick={() => handleDigit(5)} className={digitClass}>5</button>
      <button onClick={() => handleDigit(6)} className={digitClass}>6</button>
      <button onClick={() => handleOperation('*')} className={opClass}>×</button>
      
      <button onClick={() => handleDigit(1)} className={digitClass}>1</button>
      <button onClick={() => handleDigit(2)} className={digitClass}>2</button>
      <button onClick={() => handleDigit(3)} className={digitClass}>3</button>
      <button onClick={() => handleOperation('-')} className={opClass}>−</button>
      
      <button onClick={() => handleDigit(0)} className={`${digitClass} col-span-2`}>0</button>
      <button onClick={handleEquals} className={opClass}>=</button>
      <button onClick={() => handleOperation('+')} className={opClass}>+</button>
    </div>
  )
}

export function Calculator({ network: providedNetwork }: CalculatorProps) {
  const [network] = useState(() => providedNetwork || new Network('calculator-network'))
  const [calculator] = useState(() => {
    const calc = new CalculatorStateMachine('calc')
    // Add all gadgets to network
    network.add(...calc.getAllGadgets())
    // Initial propagation
    network.propagate()
    return calc
  })
  
  return (
    <NetworkProvider network={network}>
      <div className="bg-gray-700 p-4 rounded-lg shadow-xl max-w-sm">
        <h2 className="text-white text-xl font-bold mb-4">Calculator</h2>
        <CalculatorDisplay calculator={calculator} />
        <CalculatorButtons calculator={calculator} network={network} />
      </div>
    </NetworkProvider>
  )
}