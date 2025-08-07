import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { GadgetTemplate } from '~/propagation-core/types/template'
import { CategorySelector } from './CategorySelector'
import { GadgetGrid } from './GadgetGrid'
import { cn } from '~/lib/utils'

interface DreamsGadgetMenuProps {
  isOpen: boolean
  onClose: () => void
  items: Array<GadgetTemplate & { id: string; usageCount: number }>
  categories: string[]
  onUseItem: (itemId: string) => void
  getItemsByCategory: (category?: string) => Array<GadgetTemplate & { id: string; usageCount: number }>
}

type MenuState = 'closed' | 'categories' | 'gadgets'

export function DreamsGadgetMenu({
  isOpen,
  onClose,
  items,
  categories,
  onUseItem,
  getItemsByCategory
}: DreamsGadgetMenuProps) {
  const [menuState, setMenuState] = useState<MenuState>('closed')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  
  // Update menu state when isOpen changes
  useEffect(() => {
    if (isOpen) {
      setMenuState('categories')
    } else {
      setMenuState('closed')
      setSelectedCategory(null)
    }
  }, [isOpen])
  
  // Handle category selection
  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category)
    setMenuState('gadgets')
  }, [])
  
  // Handle going back
  const handleBack = useCallback(() => {
    if (menuState === 'gadgets') {
      setMenuState('categories')
      setSelectedCategory(null)
    } else if (menuState === 'categories') {
      onClose()
    }
  }, [menuState, onClose])
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuState !== 'closed') {
        handleBack()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleBack, menuState])
  
  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('gadgetPaletteItem', itemId)
    onUseItem(itemId)
  }, [onUseItem])
  
  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null)
  }, [])
  
  // Handle click outside
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])
  
  if (menuState === 'closed') return null
  
  // Get items for selected category
  const categoryItems = selectedCategory ? getItemsByCategory(selectedCategory) : []
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none"
    >
      {/* Click target area only where menu is visible */}
      <div 
        className="absolute inset-x-0 bottom-0 pointer-events-auto"
        style={{ height: menuState === 'gadgets' ? '400px' : '110px' }}
        onClick={handleBackdropClick}
      />
      
      {/* Menu container */}
      <div className="relative pointer-events-auto">
        {/* Gadget grid layer */}
        {menuState === 'gadgets' && selectedCategory && (
          <div className={cn(
            "absolute bottom-full left-0 right-0 mb-1",
            "animate-in slide-in-from-bottom-2 fade-in duration-200",
            "flex justify-center"
          )}>
            <GadgetGrid
              category={selectedCategory}
              items={categoryItems}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggedItemId={draggedItemId}
              onBack={handleBack}
            />
          </div>
        )}
        
        {/* Category selector layer */}
        <div className={cn(
          "relative bg-background border-t shadow-2xl",
          "animate-in slide-in-from-bottom-4 fade-in duration-200"
        )}>
          <CategorySelector
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategorySelect}
            isExpanded={menuState === 'gadgets'}
            onClose={onClose}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}