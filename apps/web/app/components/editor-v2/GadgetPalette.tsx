import { useState } from 'react'
import { useSubmit } from 'react-router'
import { allPrimitiveGadgets, getGadgetsByCategory } from '@bassline/core'
import type { PrimitiveGadget } from '@bassline/core'

interface GadgetPaletteProps {
  groupId: string
  onGadgetSelect?: (gadgetId: string) => void
}

const categoryIcons = {
  math: '🔢',
  string: '📝',
  logic: '🔀',
  control: '🎛️',
  array: '📊',
}

export function GadgetPalette({ groupId, onGadgetSelect }: GadgetPaletteProps) {
  const submit = useSubmit()
  const [selectedCategory, setSelectedCategory] = useState<PrimitiveGadget['category']>('math')
  
  const categories: PrimitiveGadget['category'][] = ['math', 'string', 'logic', 'control', 'array']
  const gadgets = getGadgetsByCategory(selectedCategory)
  
  const handleGadgetClick = (gadget: PrimitiveGadget) => {
    // Create a gadget instance
    submit({
      intent: 'create-gadget',
      groupId,
      gadgetType: gadget.id,
      position: JSON.stringify({ x: 200, y: 200 }) // Default position
    }, {
      method: 'post',
      action: '/api/editor-v2/actions',
      navigate: false
    })
    
    onGadgetSelect?.(gadget.id)
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-64">
      <h3 className="font-semibold mb-3">Gadget Palette</h3>
      
      {/* Category tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {categoryIcons[category as keyof typeof categoryIcons] || ''} {category}
          </button>
        ))}
      </div>
      
      {/* Gadget list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {gadgets.map((gadget) => (
          <button
            key={gadget.id}
            onClick={() => handleGadgetClick(gadget)}
            className="w-full text-left p-2 rounded hover:bg-gray-50 border border-gray-200"
          >
            <div className="font-medium">{gadget.name}</div>
            <div className="text-xs text-gray-500">{gadget.description}</div>
            <div className="text-xs text-gray-400 mt-1">
              {gadget.inputs.join(', ')} → {gadget.outputs.join(', ')}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}