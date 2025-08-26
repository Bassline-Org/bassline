/**
 * InputControl - React component for user input in OrdinalCell nodes
 */

import React, { useState, useEffect } from 'react'
import { OrdinalCell } from 'proper-bassline/src/cells/basic'
import { num, str, bool, prettyPrint } from 'proper-bassline/src/types'
import type { LatticeValue } from 'proper-bassline/src/types'

interface InputControlProps {
  cell: OrdinalCell
  onValueChange?: () => void
}

export function InputControl({ cell, onValueChange }: InputControlProps) {
  const [inputValue, setInputValue] = useState('')
  const [inputType, setInputType] = useState<'number' | 'string' | 'boolean'>('number')
  const [currentValue, setCurrentValue] = useState<LatticeValue | null>(null)
  
  useEffect(() => {
    // Create a receiver to listen for updates
    const receiver = {
      id: `input-control-${Math.random()}`,
      accept: () => {
        const value = cell.getValue()
        setCurrentValue(cell.getOutput())
        
        // Update input field to reflect current value
        if (value !== null) {
          if (typeof value === 'number') {
            setInputValue(String(value))
            setInputType('number')
          } else if (typeof value === 'string') {
            setInputValue(value)
            setInputType('string')
          } else if (typeof value === 'boolean') {
            setInputValue(String(value))
            setInputType('boolean')
          }
        }
      }
    } as any
    
    // Register as downstream
    cell.addDownstream(receiver)
    
    // Get initial value
    const initialValue = cell.getValue()
    setCurrentValue(cell.getOutput())
    if (initialValue !== null) {
      if (typeof initialValue === 'number') {
        setInputValue(String(initialValue))
        setInputType('number')
      } else if (typeof initialValue === 'string') {
        setInputValue(initialValue)
        setInputType('string')
      } else if (typeof initialValue === 'boolean') {
        setInputValue(String(initialValue))
        setInputType('boolean')
      }
    }
    
    // Cleanup
    return () => {
      cell.removeDownstream(receiver)
    }
  }, [cell])
  
  const handleSubmit = () => {
    console.log('[InputControl] Submitting value:', inputValue, 'type:', inputType)
    try {
      let value: LatticeValue
      
      switch (inputType) {
        case 'number':
          const numValue = parseFloat(inputValue)
          if (!isNaN(numValue)) {
            value = num(numValue)
            console.log('[InputControl] Setting number value:', value)
            cell.userInput(value)
            console.log('[InputControl] Called userInput, triggering onValueChange')
            onValueChange?.()
          }
          break
          
        case 'string':
          value = str(inputValue)
          console.log('[InputControl] Setting string value:', value)
          cell.userInput(value)
          console.log('[InputControl] Called userInput, triggering onValueChange')
          onValueChange?.()
          break
          
        case 'boolean':
          value = bool(inputValue.toLowerCase() === 'true')
          console.log('[InputControl] Setting boolean value:', value)
          cell.userInput(value)
          console.log('[InputControl] Called userInput, triggering onValueChange')
          onValueChange?.()
          break
      }
    } catch (e) {
      console.error('Error setting value:', e)
    }
  }
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <select
          value={inputType}
          onChange={(e) => setInputType(e.target.value as any)}
          className="px-1 py-0.5 text-xs border rounded"
        >
          <option value="number">Number</option>
          <option value="string">String</option>
          <option value="boolean">Boolean</option>
        </select>
        
        <input
          type={inputType === 'number' ? 'number' : 'text'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit()
            }
          }}
          className="flex-1 px-2 py-0.5 text-sm border rounded"
          placeholder={`Enter ${inputType}...`}
        />
        
        <button
          onClick={handleSubmit}
          className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Set
        </button>
      </div>
      
      <div className="text-xs text-gray-500">
        Current: {prettyPrint(currentValue)}
      </div>
    </div>
  )
}