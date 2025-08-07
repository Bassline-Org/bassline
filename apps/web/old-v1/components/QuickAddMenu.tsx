import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Plus, Package, Circle, Square } from 'lucide-react'
import type { Position } from '~/propagation-core'

interface QuickAddMenuProps {
  position: Position
  onAddContact: (position: Position) => void
  onAddBoundaryContact: (position: Position, direction: 'input' | 'output') => void
  onAddGadget: (position: Position) => void
  onClose: () => void
}

export function QuickAddMenu({ 
  position, 
  onAddContact, 
  onAddBoundaryContact, 
  onAddGadget,
  onClose 
}: QuickAddMenuProps) {
  return (
    <Card 
      className="absolute z-50 p-2 shadow-lg"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="justify-start"
          onClick={() => {
            onAddContact(position)
            onClose()
          }}
        >
          <Circle className="w-4 h-4 mr-2" />
          Contact
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          className="justify-start"
          onClick={() => {
            onAddBoundaryContact(position, 'input')
            onClose()
          }}
        >
          <Circle className="w-4 h-4 mr-2 text-green-500" />
          Input Boundary
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          className="justify-start"
          onClick={() => {
            onAddBoundaryContact(position, 'output')
            onClose()
          }}
        >
          <Circle className="w-4 h-4 mr-2 text-blue-500" />
          Output Boundary
        </Button>
        
        <div className="border-t my-1" />
        
        <Button
          size="sm"
          variant="ghost"
          className="justify-start"
          onClick={() => {
            onAddGadget(position)
            onClose()
          }}
        >
          <Package className="w-4 h-4 mr-2" />
          New Gadget
        </Button>
      </div>
    </Card>
  )
}