import { useRef, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '~/lib/utils'

// Category icons - using Unicode symbols for now
const categoryIcons: Record<string, string> = {
  'Math': '∑',
  'Logic': '⊻',
  'Data Flow': '⟷',
  'Set Operations': '∩',
  'Control': '⚡',
  'Custom': '✦',
  'All': '◈'
}

interface CategorySelectorProps {
  categories: string[]
  selectedCategory: string | null
  onSelectCategory: (category: string) => void
  isExpanded: boolean
  onClose: () => void
}

export function CategorySelector({
  categories,
  selectedCategory,
  onSelectCategory,
  isExpanded,
  onClose
}: CategorySelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const allCategories = ['All', ...categories]
  
  // Auto-scroll to selected category
  useEffect(() => {
    if (selectedCategory && scrollContainerRef.current) {
      const selectedIndex = allCategories.indexOf(selectedCategory)
      if (selectedIndex >= 0) {
        const button = scrollContainerRef.current.children[selectedIndex] as HTMLElement
        button?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [selectedCategory, allCategories])
  
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
  
  return (
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
      
      {/* Categories container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {allCategories.map((category) => {
          const isSelected = category === selectedCategory
          const icon = categoryIcons[category] || '◆'
          
          return (
            <Button
              key={category}
              variant={isSelected && isExpanded ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-shrink-0 min-w-[80px] h-[72px] flex flex-col gap-0.5 p-2",
                "transition-all duration-200",
                isSelected && isExpanded && "ring-2 ring-primary"
              )}
              onClick={() => onSelectCategory(category)}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-xs">{category}</span>
            </Button>
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
  )
}