import { Card } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { ChevronDown, Package } from 'lucide-react'
import type { GadgetTemplate } from '~/propagation-core/types/template'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { getGadgetIcon } from './gadget-icons'

interface GadgetGridProps {
  category: string
  items: Array<GadgetTemplate & { id: string; usageCount: number }>
  onDragStart: (e: React.DragEvent, itemId: string) => void
  onDragEnd: () => void
  draggedItemId: string | null
  onBack: () => void
}

export function GadgetGrid({
  category,
  items,
  onDragStart,
  onDragEnd,
  draggedItemId,
  onBack
}: GadgetGridProps) {
  return (
    <div className="w-2/3 max-w-4xl">
      <Card className="bg-background shadow-2xl p-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">{category}</h3>
        <Button
          size="sm"
          variant="ghost"
          className="p-1"
          onClick={onBack}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Gadget grid */}
      <TooltipProvider>
        <div className="grid grid-cols-10 gap-4">
          {items.map((item) => {
            const Icon = getGadgetIcon(item.name)
            const isDragging = draggedItemId === item.id
            
            return (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <div
                    draggable
                    onDragStart={(e) => onDragStart(e, item.id)}
                    onDragEnd={onDragEnd}
                    className={cn(
                      "relative group cursor-move",
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
          
          {/* Empty state */}
          {items.length === 0 && (
            <div className="col-span-10 text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No gadgets in this category</p>
            </div>
          )}
        </div>
      </TooltipProvider>
    </Card>
    </div>
  )
}