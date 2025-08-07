import { useMemo } from 'react'
import type { GadgetTemplate } from '~/propagation-core/types/template'
import { Card } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Trash2, GripVertical } from 'lucide-react'

interface PaletteItemProps {
  item: GadgetTemplate & { id: string; usageCount: number }
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
}

export function PaletteItem({ item, onRemove, onDragStart, onDragEnd }: PaletteItemProps) {
  // Calculate input/output counts from boundaries
  const { inputCount, outputCount } = useMemo(() => {
    const inputs = item.contacts.filter((c, idx) => 
      item.boundaryIndices.includes(idx) && c.boundaryDirection === 'input'
    ).length
    const outputs = item.contacts.filter((c, idx) => 
      item.boundaryIndices.includes(idx) && c.boundaryDirection === 'output'
    ).length
    return { inputCount: inputs, outputCount: outputs }
  }, [item])
  
  return (
    <Card 
      className="p-3 cursor-move hover:shadow-lg transition-shadow group"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start justify-between gap-2">
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{item.name}</h4>
          
          {item.description && (
            <p className="text-xs text-gray-600 truncate mt-1">{item.description}</p>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-gray-600">{inputCount} in</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-xs text-gray-600">{outputCount} out</span>
            </div>
            {item.usageCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                {item.usageCount}x
              </Badge>
            )}
          </div>
        </div>
        
        <Button
          size="sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  )
}