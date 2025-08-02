import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { Card } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const nodeVariants = cva(
  "w-[60px] h-[48px] transition-all shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden",
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
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger edit if clicking on drag handle
    if (!(e.target as HTMLElement).classList.contains('drag-handle')) {
      setEditValue(String(nodeData.content ?? ''))
      setIsEditing(true)
    }
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
        onClick={handleClick}
      >
        {/* Drag handle */}
        <div className="drag-handle absolute top-0 left-0 right-0 h-2 bg-muted/50 cursor-move hover:bg-muted/70 transition-colors" />
        
        {/* Invisible handles covering left and right halves */}
        <Handle 
          type="target" 
          position={Position.Left}
          className="!opacity-0 !pointer-events-auto !w-1/2 !h-full !left-0 !top-0 !transform-none !border-0 !bg-transparent"
          style={{ position: 'absolute' }}
        />
        <Handle 
          type="source" 
          position={Position.Right}
          className="!opacity-0 !pointer-events-auto !w-1/2 !h-full !right-0 !top-0 !transform-none !border-0 !bg-transparent"
          style={{ position: 'absolute' }}
        />
        
        {/* Content */}
        <div className="flex flex-col h-full pt-2 pb-1 px-1">
          {/* Blend mode indicator */}
          {nodeData.blendMode === 'merge' && (
            <div className="absolute top-2 right-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
            </div>
          )}
          
          {/* Main content area */}
          <div className="flex-1 flex items-center justify-center">
            {isEditing ? (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSubmit}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-6 text-xs px-1 py-0"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className={cn(
                "text-xs font-mono text-center truncate max-w-full px-1",
                nodeData.content === undefined ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {nodeData.content !== undefined ? String(nodeData.content) : '∅'}
              </div>
            )}
          </div>
        </div>
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