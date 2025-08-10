/**
 * GadgetPalette - Horizontal bottom palette like the old v1 design
 * Shows gadgets in a scrollable horizontal list
 */

import { useState } from 'react'
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '~/lib/utils'

interface PrimitiveInfo {
  qualifiedName: string
  id: string
  name: string
  inputs: string[]
  outputs: string[]
  category?: string
  description?: string
}

interface GadgetPaletteProps {
  isVisible: boolean
  onToggleVisibility: () => void
  onGadgetPlace?: (qualifiedName: string, position: { x: number, y: number }) => void
  primitives: PrimitiveInfo[]
  loading?: boolean
  error?: string | null
}

const categoryColors: Record<string, string> = {
  math: 'bg-blue-500',
  string: 'bg-green-500',
  logic: 'bg-purple-500',
  control: 'bg-orange-500',
  array: 'bg-pink-500',
  default: 'bg-gray-500'
}

const categoryIcons: Record<string, string> = {
  math: '🔢',
  string: '📝',
  logic: '🔀',
  control: '🎛️',
  array: '📊',
  default: '⚡'
}

export function GadgetPalette({
  isVisible,
  onToggleVisibility,
  onGadgetPlace,
  primitives,
  loading = false,
  error = null
}: GadgetPaletteProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  // Categorize primitives
  const categorizedPrimitives: Record<string, PrimitiveInfo[]> = {
    math: [],
    string: [],
    logic: [],
    control: [],
    array: [],
    other: []
  }
  
  primitives.forEach(p => {
    if (['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'abs', 'min', 'max'].includes(p.id)) {
      categorizedPrimitives.math.push(p)
    } else if (['concat', 'split', 'substring', 'length', 'toUpper', 'toLower', 'trim', 'join'].includes(p.id)) {
      categorizedPrimitives.string.push(p)
    } else if (['and', 'or', 'not', 'xor', 'equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterOrEqual', 'lessOrEqual'].includes(p.id)) {
      categorizedPrimitives.logic.push(p)
    } else if (['gate', 'switch', 'switchGadget', 'mux', 'demux', 'delay', 'latch'].includes(p.id)) {
      categorizedPrimitives.control.push(p)
    } else if (['append', 'prepend', 'reverse', 'slice', 'first', 'last', 'nth', 'arraySize', 'filterEmpty'].includes(p.id)) {
      categorizedPrimitives.array.push(p)
    } else {
      categorizedPrimitives.other.push(p)
    }
  })
  
  // Filter primitives based on search and category
  const getFilteredPrimitives = () => {
    let filtered = primitives
    
    if (selectedCategory !== 'all') {
      filtered = categorizedPrimitives[selectedCategory] || []
    }
    
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    return filtered
  }
  
  const filteredPrimitives = getFilteredPrimitives()
  
  // Handle drag start for a gadget
  const handleDragStart = (event: React.DragEvent, primitiveQualifiedName: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: 'gadget',
      qualifiedName: primitiveQualifiedName
    }))
    event.dataTransfer.effectAllowed = 'move'
  }
  
  // Handle click to place
  const handleClick = (primitiveQualifiedName: string) => {
    if (onGadgetPlace) {
      // Place above the palette
      const centerX = window.innerWidth / 2
      const bottomY = window.innerHeight - 200
      onGadgetPlace(primitiveQualifiedName, { x: centerX - 30, y: bottomY - 100 })
    }
  }
  
  const getCategory = (primitive: PrimitiveInfo) => {
    for (const [cat, prims] of Object.entries(categorizedPrimitives)) {
      if (prims.includes(primitive)) return cat
    }
    return 'other'
  }
  
  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggleVisibility}
        className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2 z-20",
          "bg-white dark:bg-gray-800 rounded-t-lg px-4 py-2",
          "border border-b-0 border-gray-200 dark:border-gray-700",
          "hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors",
          "flex items-center gap-2 text-sm font-medium"
        )}
      >
        {isVisible ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        Gadgets
      </button>
      
      {/* Palette Panel */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-10",
          "bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700",
          "transition-all duration-300 ease-in-out",
          isVisible ? "h-40" : "h-0 overflow-hidden"
        )}
      >
        {isVisible && (
          <div className="h-full flex flex-col">
            {/* Header with search and filters */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              {/* Category filters */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    "px-2 py-1 text-xs rounded transition-colors",
                    selectedCategory === 'all' 
                      ? "bg-blue-500 text-white" 
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  )}
                >
                  All
                </button>
                {Object.keys(categorizedPrimitives).filter(cat => 
                  cat !== 'other' && categorizedPrimitives[cat].length > 0
                ).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-2 py-1 text-xs rounded transition-colors flex items-center gap-1",
                      selectedCategory === cat 
                        ? `${categoryColors[cat]} text-white` 
                        : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                  >
                    <span>{categoryIcons[cat]}</span>
                    <span className="capitalize">{cat}</span>
                    <span className="opacity-60">({categorizedPrimitives[cat].length})</span>
                  </button>
                ))}
              </div>
              
              {/* Search */}
              <div className="flex-1 max-w-xs relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search gadgets..."
                  className="w-full pl-8 pr-8 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              
              <div className="text-xs text-gray-500">
                {filteredPrimitives.length} gadgets
              </div>
            </div>
            
            {/* Gadget list */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="flex gap-2 p-3 h-full">
                {loading && (
                  <div className="flex items-center justify-center text-gray-500 text-sm">
                    Loading gadgets...
                  </div>
                )}
                
                {error && (
                  <div className="flex items-center justify-center text-red-500 text-sm">
                    Error: {error}
                  </div>
                )}
                
                {!loading && !error && filteredPrimitives.length === 0 && (
                  <div className="flex items-center justify-center text-gray-500 text-sm w-full">
                    No gadgets found
                  </div>
                )}
                
                {!loading && !error && filteredPrimitives.map(primitive => {
                  const category = getCategory(primitive)
                  return (
                    <div
                      key={primitive.qualifiedName}
                      draggable
                      onDragStart={(e) => handleDragStart(e, primitive.qualifiedName)}
                      onClick={() => handleClick(primitive.qualifiedName)}
                      className={cn(
                        "flex-shrink-0 w-24 h-20 rounded-lg border cursor-pointer",
                        "bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900",
                        "border-gray-200 dark:border-gray-700",
                        "hover:shadow-lg hover:scale-105 transition-all",
                        "flex flex-col items-center justify-center gap-1"
                      )}
                    >
                      <div className="text-2xl">
                        {categoryIcons[category] || categoryIcons.default}
                      </div>
                      <div className="text-xs font-medium text-center px-1">
                        {primitive.id}
                      </div>
                      <div className="flex gap-1 text-xs opacity-60">
                        <span>{primitive.inputs.length}→</span>
                        <span>{primitive.outputs.length}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}