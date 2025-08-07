import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Package, Clock, TrendingUp, Search } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { PaletteItem } from './PaletteItem'
import type { GadgetTemplate } from '~/propagation-core/types/template'

interface GadgetPaletteProps {
  items: Array<GadgetTemplate & { id: string; usageCount: number }>
  categories: string[]
  isVisible: boolean
  onToggleVisibility: () => void
  onRemoveItem: (itemId: string) => void
  onUseItem: (itemId: string) => void
  getItemsByCategory: (category?: string) => Array<GadgetTemplate & { id: string; usageCount: number }>
  getMostUsed: (limit?: number) => Array<GadgetTemplate & { id: string; usageCount: number }>
  getRecent: (limit?: number) => Array<GadgetTemplate & { id: string; usageCount: number }>
}

type ViewMode = 'all' | 'recent' | 'popular' | 'category'

export function GadgetPalette({
  items,
  categories,
  isVisible,
  onToggleVisibility,
  onRemoveItem,
  onUseItem,
  getItemsByCategory,
  getMostUsed,
  getRecent
}: GadgetPaletteProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('gadgetPaletteItem', itemId)
  }, [])
  
  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null)
  }, [])
  
  // Filter items based on view mode and search
  const displayItems = (() => {
    let filtered = items
    
    switch (viewMode) {
      case 'recent':
        filtered = getRecent(10)
        break
      case 'popular':
        filtered = getMostUsed(10)
        break
      case 'category':
        filtered = getItemsByCategory(selectedCategory)
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
  
  if (!isVisible) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={onToggleVisibility}
          size="sm"
          className="rounded-l-md rounded-r-none"
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
      {viewMode === 'all' && categories.length > 0 && (
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
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      )}
      
      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {displayItems.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No gadgets found</p>
            {viewMode === 'all' && items.length === 0 && (
              <p className="text-xs mt-2">Extract gadgets to add them to your palette</p>
            )}
          </div>
        ) : (
          displayItems.map(item => (
            <PaletteItem
              key={item.id}
              item={item}
              onRemove={() => onRemoveItem(item.id)}
              onDragStart={(e) => {
                handleDragStart(e, item.id)
                onUseItem(item.id)
              }}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t text-xs text-gray-600">
        Drag gadgets to canvas to use them
      </div>
    </div>
  )
}