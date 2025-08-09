import { useState, useEffect } from 'react'
import { getNetworkClient } from '~/network/client'

interface PrimitiveInfo {
  qualifiedName: string
  id: string
  name: string
  inputs: string[]
  outputs: string[]
  category?: string
  description?: string
  isPure?: boolean
}

interface KernelGadgetPaletteProps {
  groupId: string
  onGadgetPlace?: (qualifiedName: string, position: { x: number, y: number }) => void
}

const categoryIcons = {
  math: '🔢',
  string: '📝', 
  logic: '🔀',
  control: '🎛️',
  array: '📊',
  time: '⏰',
  io: '💾',
  validation: '✅',
}

interface PaletteState {
  primitives: PrimitiveInfo[]
  loading: boolean
  error: string | null
  selectedPrimitive: string | null
  placementMode: boolean
}

export function KernelGadgetPalette({ groupId, onGadgetPlace }: KernelGadgetPaletteProps) {
  const [state, setState] = useState<PaletteState>({
    primitives: [],
    loading: true,
    error: null,
    selectedPrimitive: null,
    placementMode: false
  })
  
  const [selectedCategory, setSelectedCategory] = useState<string>('math')
  
  // Load primitive info from kernel via NetworkClient
  useEffect(() => {
    const loadPrimitives = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))
        
        const client = getNetworkClient()
        
        // Try the new kernel method first, fallback to static data
        let primitiveInfo: PrimitiveInfo[] = []
        
        try {
          primitiveInfo = await client.listPrimitiveInfo()
        } catch (kernelError) {
          console.warn('Kernel primitive loading failed, using static fallback:', kernelError)
          
          // Fallback to static primitive data
          const { allPrimitiveGadgets } = await import('@bassline/core')
          primitiveInfo = allPrimitiveGadgets.map(gadget => ({
            qualifiedName: gadget.id,
            id: gadget.id,
            name: gadget.name,
            inputs: gadget.inputs,
            outputs: gadget.outputs,
            category: gadget.category,
            description: gadget.description,
            isPure: gadget.isPure
          }))
        }
        
        setState(prev => ({
          ...prev,
          primitives: primitiveInfo,
          loading: false
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load primitives'
        }))
      }
    }
    
    loadPrimitives()
  }, [])
  
  // Get unique categories from loaded primitives
  const categories = Array.from(
    new Set(state.primitives.map(p => p.category).filter(Boolean))
  ).sort()
  
  // Filter primitives by selected category
  const filteredPrimitives = state.primitives.filter(
    p => p.category === selectedCategory
  )
  
  const handlePrimitiveClick = (primitive: PrimitiveInfo) => {
    if (state.selectedPrimitive === primitive.qualifiedName) {
      // Toggle off selection
      setState(prev => ({
        ...prev,
        selectedPrimitive: null,
        placementMode: false
      }))
    } else {
      // Select primitive and enter placement mode
      setState(prev => ({
        ...prev,
        selectedPrimitive: primitive.qualifiedName,
        placementMode: true
      }))
    }
  }
  
  const handleCanvasClick = (event: React.MouseEvent) => {
    if (state.placementMode && state.selectedPrimitive) {
      // Get click position relative to canvas
      const rect = event.currentTarget.getBoundingClientRect()
      const position = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }
      
      // Place the gadget
      onGadgetPlace?.(state.selectedPrimitive, position)
      
      // Exit placement mode
      setState(prev => ({
        ...prev,
        selectedPrimitive: null,
        placementMode: false
      }))
    }
  }
  
  // Add global click handler for placement mode
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (state.placementMode && state.selectedPrimitive) {
        const target = event.target as Element
        
        // Check if click is on the editor canvas (React Flow container)
        if (target.closest('.react-flow__renderer') || target.closest('.react-flow__pane')) {
          const rect = target.getBoundingClientRect()
          const position = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          }
          
          onGadgetPlace?.(state.selectedPrimitive, position)
          
          setState(prev => ({
            ...prev,
            selectedPrimitive: null,
            placementMode: false
          }))
        }
      }
    }
    
    if (state.placementMode) {
      document.addEventListener('click', handleGlobalClick)
      return () => document.removeEventListener('click', handleGlobalClick)
    }
  }, [state.placementMode, state.selectedPrimitive, onGadgetPlace])
  
  if (state.loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 w-64">
        <h3 className="font-semibold mb-3">Gadget Palette</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin text-2xl">⚡</div>
        </div>
      </div>
    )
  }
  
  if (state.error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 w-64">
        <h3 className="font-semibold mb-3">Gadget Palette</h3>
        <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
          {state.error}
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-64">
      <h3 className="font-semibold mb-3">Gadget Palette</h3>
      
      {state.placementMode && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
          Click on the canvas to place gadget
          <button
            onClick={() => setState(prev => ({ ...prev, selectedPrimitive: null, placementMode: false }))}
            className="ml-2 text-blue-600 hover:text-blue-800"
          >
            Cancel
          </button>
        </div>
      )}
      
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
            {categoryIcons[category as keyof typeof categoryIcons] || '📦'} {category}
          </button>
        ))}
      </div>
      
      {/* Primitive list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredPrimitives.map((primitive) => (
          <button
            key={primitive.qualifiedName}
            onClick={() => handlePrimitiveClick(primitive)}
            className={`w-full text-left p-2 rounded border transition-colors ${
              state.selectedPrimitive === primitive.qualifiedName
                ? 'bg-blue-100 border-blue-300 shadow-sm'
                : 'hover:bg-gray-50 border-gray-200'
            }`}
          >
            <div className="font-medium">{primitive.name}</div>
            {primitive.description && (
              <div className="text-xs text-gray-500">{primitive.description}</div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {primitive.inputs.join(', ')} → {primitive.outputs.join(', ')}
            </div>
            {primitive.isPure && (
              <div className="text-xs text-green-600 mt-1">✅ Pure</div>
            )}
          </button>
        ))}
        
        {filteredPrimitives.length === 0 && (
          <div className="text-gray-500 text-sm text-center py-4">
            No primitives found in this category
          </div>
        )}
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        Total: {state.primitives.length} primitives loaded
      </div>
    </div>
  )
}