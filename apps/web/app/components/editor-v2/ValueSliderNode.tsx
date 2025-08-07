import React, { useCallback, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useSubmit } from 'react-router'

interface SliderNodeData {
  contact: {
    id: string
    content: unknown
    blendMode: 'accept-last' | 'merge'
  }
  groupId: string
  min?: number
  max?: number
  step?: number
}

export function ValueSliderNode({ data, selected }: NodeProps) {
  const { contact, groupId, min = 0, max = 100, step = 1 } = data as SliderNodeData
  const submit = useSubmit()
  
  // Parse current value
  const currentValue = typeof contact.content === 'number' ? contact.content : 0
  const [sliderValue, setSliderValue] = useState(currentValue)
  const [displayValue, setDisplayValue] = useState(currentValue.toString())
  
  // Update when content changes from propagation
  useEffect(() => {
    const newValue = typeof contact.content === 'number' ? contact.content : 0
    setSliderValue(newValue)
    setDisplayValue(newValue.toString())
  }, [contact.content])
  
  // Handle slider change
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    setSliderValue(value)
    setDisplayValue(value.toString())
    
    // Update contact content
    submit({
      intent: 'update-contact',
      contactId: contact.id,
      content: JSON.stringify(value)
    }, {
      method: 'post',
      action: '/api/editor/actions',
      navigate: false
    })
  }, [contact.id, submit])
  
  // Handle direct input
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value)
  }, [])
  
  const handleInputBlur = useCallback(() => {
    const value = parseFloat(displayValue)
    if (!isNaN(value)) {
      const clampedValue = Math.max(min, Math.min(max, value))
      setSliderValue(clampedValue)
      setDisplayValue(clampedValue.toString())
      
      submit({
        intent: 'update-contact',
        contactId: contact.id,
        content: JSON.stringify(clampedValue)
      }, {
        method: 'post',
        action: '/api/editor/actions',
        navigate: false
      })
    } else {
      setDisplayValue(sliderValue.toString())
    }
  }, [displayValue, min, max, sliderValue, contact.id, submit])
  
  const borderColor = selected ? 'border-blue-500' : 'border-gray-300'
  const bgColor = selected ? 'bg-blue-50' : 'bg-white'
  
  return (
    <div 
      className={`
        relative p-3 rounded-lg border-2 shadow-sm
        ${borderColor} ${bgColor}
        hover:shadow-md transition-shadow
      `}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
      />
      
      <div className="flex flex-col gap-2 min-w-[200px]">
        {/* Value display and input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="nodrag w-16 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-500">
            [{min} - {max}]
          </span>
        </div>
        
        {/* Slider */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={handleSliderChange}
          className="nodrag w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        
        {/* Blend mode indicator */}
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${contact.blendMode === 'merge' ? 'bg-purple-400' : 'bg-green-400'}`} />
          <span className="text-xs text-gray-500">{contact.blendMode}</span>
        </div>
      </div>
      
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  )
}