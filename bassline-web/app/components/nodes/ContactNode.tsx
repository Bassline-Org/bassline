import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Circle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const nodeVariants = cva(
  "min-w-[100px] transition-all shadow-sm hover:shadow-md",
  {
    variants: {
      nodeType: {
        contact: "node-gradient-contact node-border-contact",
        boundary: "node-gradient-boundary node-border-boundary"
      },
      selected: {
        true: "ring-2",
        false: ""
      }
    },
    compoundVariants: [
      {
        nodeType: "contact",
        selected: true,
        className: "node-ring-contact"
      },
      {
        nodeType: "boundary",
        selected: true,
        className: "node-ring-boundary"
      }
    ],
    defaultVariants: {
      nodeType: "contact",
      selected: false
    }
  }
)

const handleVariants = cva(
  "!w-3 !h-3",
  {
    variants: {
      nodeType: {
        contact: "[&]:bg-[var(--node-contact)] [&]:border-[color-mix(in_oklch,var(--node-contact),black_20%)]",
        boundary: "[&]:bg-[var(--node-boundary)] [&]:border-[color-mix(in_oklch,var(--node-boundary),black_20%)]"
      }
    },
    defaultVariants: {
      nodeType: "contact"
    }
  }
)

export interface ContactNodeData {
  content: any
  blendMode: 'accept-last' | 'merge'
  isBoundary: boolean
  setContent: (content: any) => void
}

export const ContactNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ContactNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)
  
  const handleDoubleClick = useCallback(() => {
    setEditValue(String(nodeData.content ?? ''))
    setIsEditing(true)
  }, [nodeData.content])
  
  const handleSubmit = useCallback(() => {
    // Try to parse as JSON first, then as number, then as string
    let newContent: any = editValue
    try {
      newContent = JSON.parse(editValue)
    } catch {
      // Try as number
      const num = Number(editValue)
      if (!isNaN(num)) {
        newContent = num
      }
    }
    
    nodeData.setContent(newContent)
    setIsEditing(false)
  }, [editValue, nodeData])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }, [handleSubmit])
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Use client coordinates for fixed positioning
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }, [])
  
  const handleResetValue = useCallback(() => {
    nodeData.setContent(undefined)
    setShowContextMenu(false)
  }, [nodeData])
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setShowContextMenu(false)
    if (showContextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [showContextMenu])
  
  const nodeType = nodeData.isBoundary ? 'boundary' : 'contact'
  
  return (
    <>
      <Card 
        className={cn(nodeVariants({ nodeType, selected }))}
        onContextMenu={handleContextMenu}
      >
        <Handle 
          type="target" 
          position={Position.Left}
          className={handleVariants({ nodeType })}
        />
        <Handle 
          type="source" 
          position={Position.Right}
          className={handleVariants({ nodeType })}
        />
        
        <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-1">
              <Circle className={cn(
                "w-3 h-3",
                nodeData.isBoundary ? "[&]:fill-[var(--node-boundary)] [&]:text-[var(--node-boundary)]" : "[&]:fill-[var(--node-contact)] [&]:text-[var(--node-contact)]"
              )} />
              {nodeData.isBoundary && (
                <span className="text-xs font-medium opacity-70">boundary</span>
              )}
            </div>
            <Badge 
              variant={nodeData.blendMode === 'merge' ? 'default' : 'secondary'} 
              className="text-xs py-0 px-1"
            >
              {nodeData.blendMode === 'merge' ? 'M' : 'L'}
            </Badge>
          </div>
          
          <div onDoubleClick={handleDoubleClick} className="min-h-[24px]">
            {isEditing ? (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSubmit}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-6 text-sm px-2"
              />
            ) : (
              <div className={`text-sm font-mono text-center ${
                nodeData.content === undefined ? 'text-gray-400' : 'text-gray-700'
              }`}>
                {nodeData.content !== undefined ? String(nodeData.content) : '∅'}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    
    {/* Context Menu - Portal to document body */}
    {showContextMenu && createPortal(
      <div
        ref={contextMenuRef}
        className="fixed z-[9999] min-w-[150px] bg-popover text-popover-foreground rounded-md border shadow-md p-1"
        style={{ 
          left: `${contextMenuPos.x}px`, 
          top: `${contextMenuPos.y}px`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="flex w-full items-center px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
          onClick={handleResetValue}
        >
          Reset Value (∅)
        </button>
      </div>,
      document.body
    )}
    </>
  )
})