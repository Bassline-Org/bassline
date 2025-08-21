/**
 * Calculator Component - React UI for the Calculator app
 */

import React, { useCallback } from 'react'
import { useTemplate, useContact } from './react-templates'
import { CalculatorTemplate } from './calculator-app'

interface CalculatorProps {
  appId?: string
}

export function Calculator({ appId = 'calculator-app' }: CalculatorProps) {
  const calculator = useTemplate(CalculatorTemplate, {}, appId)
  
  // Calculator inputs
  const [, setNumberPressed] = useContact<string>(calculator.gadget, 'numberPressed')
  const [, setOperatorPressed] = useContact<string>(calculator.gadget, 'operatorPressed')
  const [, setFunctionPressed] = useContact<string>(calculator.gadget, 'functionPressed')
  
  // Calculator outputs
  const [displayValue] = useContact<string>(calculator.gadget, 'displayValue')
  const [calculationHistory] = useContact<string[]>(calculator.gadget, 'calculationHistory')
  
  // Button click handlers
  const handleNumberClick = useCallback((number: string) => {
    setNumberPressed(number)
    requestAnimationFrame(() => setNumberPressed(''))
  }, [setNumberPressed])
  
  const handleOperatorClick = useCallback((operator: string) => {
    setOperatorPressed(operator)
    requestAnimationFrame(() => setOperatorPressed(''))
  }, [setOperatorPressed])
  
  const handleFunctionClick = useCallback((func: string) => {
    setFunctionPressed(func)
    requestAnimationFrame(() => setFunctionPressed(''))
  }, [setFunctionPressed])
  
  // Button component for consistent styling
  const Button = ({ 
    children, 
    onClick, 
    className = '', 
    variant = 'default' 
  }: { 
    children: React.ReactNode
    onClick: () => void
    className?: string
    variant?: 'default' | 'operator' | 'function'
  }) => {
    const baseClasses = 'min-h-[48px] rounded-lg font-medium text-lg transition-colors active:scale-95'
    const variantClasses = {
      default: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
      operator: 'bg-orange-500 hover:bg-orange-600 text-white',
      function: 'bg-gray-400 hover:bg-gray-500 text-white'
    }
    
    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        onClick={onClick}
      >
        {children}
      </button>
    )
  }
  
  return (
    <div className="p-4 bg-gray-100 h-full flex flex-col min-w-[300px]">
      {/* Display */}
      <div className="mb-4">
        <div className="bg-black text-white p-4 rounded-lg text-right">
          <div className="text-2xl font-mono leading-tight min-h-[36px] flex items-center justify-end">
            {displayValue || '0'}
          </div>
        </div>
      </div>
      
      {/* Button Grid */}
      <div className="flex-1 grid grid-cols-4 gap-2">
        {/* Row 1 */}
        <Button 
          variant="function" 
          onClick={() => handleFunctionClick('clear')}
          className="col-span-2"
        >
          Clear
        </Button>
        <Button 
          variant="function" 
          onClick={() => handleFunctionClick('backspace')}
        >
          ⌫
        </Button>
        <Button 
          variant="operator" 
          onClick={() => handleOperatorClick('/')}
        >
          ÷
        </Button>
        
        {/* Row 2 */}
        <Button onClick={() => handleNumberClick('7')}>7</Button>
        <Button onClick={() => handleNumberClick('8')}>8</Button>
        <Button onClick={() => handleNumberClick('9')}>9</Button>
        <Button 
          variant="operator" 
          onClick={() => handleOperatorClick('*')}
        >
          ×
        </Button>
        
        {/* Row 3 */}
        <Button onClick={() => handleNumberClick('4')}>4</Button>
        <Button onClick={() => handleNumberClick('5')}>5</Button>
        <Button onClick={() => handleNumberClick('6')}>6</Button>
        <Button 
          variant="operator" 
          onClick={() => handleOperatorClick('-')}
        >
          −
        </Button>
        
        {/* Row 4 */}
        <Button onClick={() => handleNumberClick('1')}>1</Button>
        <Button onClick={() => handleNumberClick('2')}>2</Button>
        <Button onClick={() => handleNumberClick('3')}>3</Button>
        <Button 
          variant="operator" 
          onClick={() => handleOperatorClick('+')}
        >
          +
        </Button>
        
        {/* Row 5 */}
        <Button 
          onClick={() => handleNumberClick('0')}
          className="col-span-2"
        >
          0
        </Button>
        <Button onClick={() => handleFunctionClick('decimal')}>.</Button>
        <Button 
          variant="operator" 
          onClick={() => handleOperatorClick('=')}
        >
          =
        </Button>
      </div>
      
      {/* History (if there's space) */}
      {calculationHistory && calculationHistory.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="text-xs text-gray-600 font-medium mb-1">History:</div>
          <div className="text-xs font-mono text-gray-500 max-h-16 overflow-y-auto">
            {calculationHistory.slice(-3).map((calc, index) => (
              <div key={index} className="truncate">{calc}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}