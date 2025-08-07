import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { ChevronLeft, ChevronRight, X, Package } from 'lucide-react'
import type { GadgetTemplate } from '~/propagation-core/types/template'
import { cn } from '~/lib/utils'
import { getGadgetIcon } from './gadget-icons'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'

// Category icons
const categoryIcons: Record<string, string> = {
  'Math': '∑',
  'Logic': '⊻',
  'Data Flow': '⟷',
  'Set Operations': '∩',
  'Control': '⚡',
  'Custom': '✦',
  'All': '◈'
}

interface InlineGadgetMenuProps {
  isOpen: boolean
  onClose: () => void
  items: Array<GadgetTemplate & { id: string; usageCount: number }>
  categories: string[]
  onUseItem: (itemId: string) => void
  getItemsByCategory: (category?: string) => Array<GadgetTemplate & { id: string; usageCount: number }>
}

export function InlineGadgetMenu({
  isOpen,
  onClose,
  items,
  categories,
  onUseItem,
  getItemsByCategory
}: InlineGadgetMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedCategory(null)
    }
  }, [isOpen])
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedCategory) {
          setSelectedCategory(null)
        } else {
          onClose()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedCategory, onClose])
  
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
  
  // Toggle category
  const toggleCategory = useCallback((category: string) => {
    setSelectedCategory(prev => prev === category ? null : category)
  }, [])
  
  // Scroll functions
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' })
    }
  }
  
  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' })
    }
  }
  
  if (!isOpen) return null
  
  const allCategories = ['All', ...categories]
  const categoryItems = selectedCategory ? getItemsByCategory(selectedCategory === 'All' ? undefined : selectedCategory) : []
  
  return createPortal(
    <div className="fixed bottom-0 left-0 right-0 z-[100] pointer-events-none">
      <div className={cn(
        "relative bg-background border-t shadow-2xl pointer-events-auto",
        "animate-in slide-in-from-bottom-4 fade-in duration-200"
      )}>
        <div className="flex items-center p-3 gap-3 select-none">
          {/* Left scroll button */}
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0 p-2"
            onClick={scrollLeft}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          {/* Scrollable container */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth items-center"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Categories */}
            {allCategories.map((category) => {
              const isSelected = category === selectedCategory
              const icon = categoryIcons[category] || '◆'
              
              return (
                <div key={category} className="flex items-center gap-3">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex-shrink-0 min-w-[80px] h-[72px] flex flex-col gap-0.5 p-2",
                      "transition-all duration-200",
                      isSelected && "ring-2 ring-primary"
                    )}
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="text-xl">{icon}</span>
                    <span className="text-xs">{category}</span>
                  </Button>
                  
                  {/* Inline gadgets */}
                  {isSelected && (
                    <div className={cn(
                      "flex gap-3 items-center",
                      "animate-in slide-in-from-left-2 fade-in duration-200"
                    )}>
                      {categoryItems.length > 0 ? (
                        <TooltipProvider>
                          {categoryItems.map((item) => {
                            const Icon = getGadgetIcon(item.name)
                            const isDragging = draggedItemId === item.id
                            
                            return (
                              <Tooltip key={item.id} delayDuration={0}>
                                <TooltipTrigger asChild>
                                  <div
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, item.id)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                      "relative group cursor-move flex-shrink-0",
                                      isDragging && "opacity-50"
                                    )}
                                  >
                                    <Card className={cn(
                                      "w-16 h-16 flex items-center justify-center",
                                      "border-2 transition-all duration-200",
                                      "hover:shadow-lg hover:scale-105",
                                      "node-gradient-primitive node-border-primitive"
                                    )}>
                                      <Icon className="w-8 h-8 text-[var(--node-primitive)]" />
                                    </Card>
                                    
                                    {/* Usage indicator */}
                                    {item.usageCount > 0 && (
                                      <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {item.usageCount > 99 ? '99+' : item.usageCount}
                                      </div>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px] z-[200]">
                                  <div>
                                    <p className="font-semibold">{item.name}</p>
                                    {item.description && (
                                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )
                          })}
                        </TooltipProvider>
                      ) : (
                        <div className="text-sm text-muted-foreground px-4">
                          No gadgets in this category
                        </div>
                      )}
                      
                      {/* Separator */}
                      <div className="w-px h-12 bg-border flex-shrink-0" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Right scroll button */}
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0 p-2"
            onClick={scrollRight}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          {/* Close button */}
          <Button
            size="sm"
            variant="ghost"
            className="flex-shrink-0 p-2"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}