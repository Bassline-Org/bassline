/**
 * GadgetPalette - Beautiful sidebar palette with old v1 design
 * Combined with modern click-to-place behavior
 */

import { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Package, Clock, TrendingUp, Search, GripVertical, Trash2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Card } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'

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

interface GadgetPaletteProps {
  isVisible: boolean
  onToggleVisibility: () => void
  onGadgetPlace?: (qualifiedName: string, position: { x: number, y: number }) => void
  primitives: PrimitiveInfo[]
  loading?: boolean
  error?: string | null
}

type ViewMode = 'all' | 'recent' | 'popular' | 'category'

const categoryIcons: Record<string, string> = {
  math: '🔢',
  string: '📝', 
  logic: '🔀',
  control: '🎛️',
  array: '📊',
  time: '⏰',
  io: '💾',
  validation: '✅',
}

export function GadgetPalette({
  isVisible,
  onToggleVisibility,
  onGadgetPlace,
  primitives,
  loading = false,
  error = null
}: GadgetPaletteProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPrimitive, setSelectedPrimitive] = useState<string | null>(null)
  const [placementMode, setPlacementMode] = useState(false)
  const [recentItems, setRecentItems] = useState<string[]>([])
  const [usageCount, setUsageCount] = useState<Record<string, number>>({})
  
  // Load recent items and usage from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('gadget-palette-stats')
    if (stored) {
      const stats = JSON.parse(stored)
      setRecentItems(stats.recent || [])
      setUsageCount(stats.usage || {})
    }
  }, [])
  
  // Save stats to localStorage
  const updateStats = useCallback((itemId: string) => {
    const newRecent = [itemId, ...recentItems.filter(id => id !== itemId)].slice(0, 10)
    const newUsage = { ...usageCount, [itemId]: (usageCount[itemId] || 0) + 1 }
    
    setRecentItems(newRecent)
    setUsageCount(newUsage)
    
    localStorage.setItem('gadget-palette-stats', JSON.stringify({
      recent: newRecent,
      usage: newUsage
    }))
  }, [recentItems, usageCount])
  
  // Get unique categories from primitives
  const categories = Array.from(
    new Set(primitives.map(p => p.category).filter(Boolean))
  ).sort()
  
  // Filter primitives based on view mode and search
  const displayItems = (() => {
    let filtered = primitives
    
    switch (viewMode) {
      case 'recent':
        filtered = primitives.filter(p => recentItems.includes(p.qualifiedName))
        break
      case 'popular':
        filtered = [...primitives].sort((a, b) => 
          (usageCount[b.qualifiedName] || 0) - (usageCount[a.qualifiedName] || 0)
        ).slice(0, 10)
        break
      case 'category':
        filtered = primitives.filter(p => p.category === selectedCategory)
        break
    }
    
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    return filtered
  })()
  
  // Handle primitive selection for click-to-place
  const handlePrimitiveClick = useCallback((primitive: PrimitiveInfo) => {
    if (selectedPrimitive === primitive.qualifiedName) {
      // Toggle off
      setSelectedPrimitive(null)
      setPlacementMode(false)
    } else {
      // Select for placement
      setSelectedPrimitive(primitive.qualifiedName)
      setPlacementMode(true)
    }
  }, [selectedPrimitive])
  
  // Handle drag start for drag-to-place
  const handleDragStart = useCallback((e: React.DragEvent, primitive: PrimitiveInfo) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('gadgetPrimitive', primitive.qualifiedName)
    updateStats(primitive.qualifiedName)
  }, [updateStats])
  
  // Global click handler for placement mode
  useEffect(() => {
    if (!placementMode || !selectedPrimitive || !onGadgetPlace) return
    
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element
      
      // Check if click is on the React Flow canvas
      if (target.closest('.react-flow__renderer') || target.closest('.react-flow__pane')) {
        const canvas = target.closest('.react-flow') as HTMLElement
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const position = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          }
          
          onGadgetPlace(selectedPrimitive, position)
          updateStats(selectedPrimitive)
          
          // Exit placement mode
          setSelectedPrimitive(null)
          setPlacementMode(false)
        }
      }
    }
    
    // Delay to avoid immediate trigger
    setTimeout(() => {
      document.addEventListener('click', handleClick)
    }, 100)
    
    return () => document.removeEventListener('click', handleClick)
  }, [placementMode, selectedPrimitive, onGadgetPlace, updateStats])
  
  // Collapsed state
  if (!isVisible) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={onToggleVisibility}
          size="sm"
          className="rounded-l-md rounded-r-none shadow-lg"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    )
  }
  
  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" />
            Gadget Palette
          </h3>
          <Button
            onClick={onToggleVisibility}
            size="sm"
            variant="ghost"
            className="p-1"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search gadgets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        
        {/* Placement mode indicator */}
        {placementMode && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
            Click on canvas to place gadget
            <button
              onClick={() => {
                setSelectedPrimitive(null)
                setPlacementMode(false)
              }}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      {/* View mode tabs */}
      <div className="flex border-b">
        <Button
          variant={viewMode === 'all' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 rounded-none"
          onClick={() => setViewMode('all')}
        >
          All
        </Button>
        <Button
          variant={viewMode === 'recent' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 rounded-none"
          onClick={() => setViewMode('recent')}
        >
          <Clock className="w-3 h-3 mr-1" />
          Recent
        </Button>
        <Button
          variant={viewMode === 'popular' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1 rounded-none"
          onClick={() => setViewMode('popular')}
        >
          <TrendingUp className="w-3 h-3 mr-1" />
          Popular
        </Button>
      </div>
      
      {/* Category filter */}
      {categories.length > 0 && (
        <div className="p-2 border-b">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value)
              if (e.target.value) setViewMode('category')
              else setViewMode('all')
            }}
            className="w-full px-2 py-1 text-sm border rounded"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {categoryIcons[cat] || '📦'} {cat}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin text-2xl">⚡</div>
          </div>
        ) : error ? (
          <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
            {error}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No gadgets found</p>
            {viewMode === 'recent' && recentItems.length === 0 && (
              <p className="text-xs mt-2">Use some gadgets to see them here</p>
            )}
          </div>
        ) : (
          displayItems.map(item => (
            <Card 
              key={item.qualifiedName}
              className={cn(
                "p-3 cursor-move hover:shadow-lg transition-shadow group",
                selectedPrimitive === item.qualifiedName && "bg-blue-100 border-blue-300 shadow-sm"
              )}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onClick={() => handlePrimitiveClick(item)}
            >
              <div className="flex items-start justify-between gap-2">
                <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {categoryIcons[item.category || ''] || ''} {item.name}
                  </h4>
                  
                  {item.description && (
                    <p className="text-xs text-gray-600 truncate mt-1">{item.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-xs text-gray-600">{item.inputs.length} in</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-xs text-gray-600">{item.outputs.length} out</span>
                    </div>
                    {usageCount[item.qualifiedName] && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        {usageCount[item.qualifiedName]}x
                      </Badge>
                    )}
                    {item.isPure && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Pure
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t text-xs text-gray-600">
        {placementMode ? 'Click on canvas to place' : 'Drag or click gadgets to use'}
      </div>
    </div>
  )
}