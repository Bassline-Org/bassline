/**
 * ValueDisplay - React component for displaying gadget values in Rete nodes
 */

import React, { useEffect, useState } from 'react'
import type { Cell } from 'proper-bassline/src/cell'
import type { Gadget } from 'proper-bassline/src/gadget'
import type { LatticeValue } from 'proper-bassline/src/types'
import { prettyPrint } from 'proper-bassline/src/types'

interface ValueDisplayProps {
  cell: Gadget  // Can be Cell or FunctionGadget
  className?: string
}

export function ValueDisplay({ cell: gadget, className = '' }: ValueDisplayProps) {
  const [value, setValue] = useState<LatticeValue | null>(gadget.getOutput())
  const [highlight, setHighlight] = useState(false)
  
  useEffect(() => {
    // Create a receiver gadget to listen for updates
    const receiver = {
      id: `value-display-${Math.random()}`,
      accept: () => {
        const newValue = gadget.getOutput()
        setValue(newValue)
        
        // Briefly highlight when value changes
        setHighlight(true)
        setTimeout(() => setHighlight(false), 300)
      }
    } as any
    
    // Register as downstream
    gadget.addDownstream(receiver)
    
    // Get initial value
    setValue(gadget.getOutput())
    
    // Cleanup
    return () => {
      gadget.removeDownstream(receiver)
    }
  }, [gadget])
  
  const displayValue = prettyPrint(value)
  
  return (
    <div 
      className={`
        px-2 py-1 text-sm font-mono rounded transition-all duration-300
        ${highlight ? 'bg-yellow-100 scale-105' : 'bg-gray-100'}
        ${className}
      `}
    >
      {displayValue}
    </div>
  )
}