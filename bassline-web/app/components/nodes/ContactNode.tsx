import { memo, useState, useCallback, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { Card } from '~/components/ui/card'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'
import { useContact } from '~/propagation-react/hooks/useContact'
import { usePropertyPanel } from '~/propagation-react/hooks/usePropertyPanel'
import { useContactSelection } from '~/propagation-react/hooks/useContactSelection'

const nodeVariants = cva(
  "w-[60px] h-[40px] transition-all shadow-sm hover:shadow-md cursor-pointer relative",
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

export const ContactNode = memo(({ id, selected }: NodeProps) => {
  const { content, blendMode, isBoundary, lastContradiction, setContent, setBlendMode } = useContact(id)
  const propertyPanel = usePropertyPanel()
  const { selectContact } = useContactSelection()
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Use client coordinates for fixed positioning
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }, [])
  
  const handleResetValue = useCallback(() => {
    setContent(undefined)
    setShowContextMenu(false)
  }, [setContent])
  
  
  const nodeType = isBoundary ? 'boundary' : 'contact'
  
  return (
    <>
      <Card 
        className={cn(
          nodeVariants({ nodeType, selected }),
          lastContradiction && "ring-2 ring-red-500"
        )}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.stopPropagation()
          selectContact(id, false) // Ensure this contact is selected
          propertyPanel.show(true)
        }}
      >
        {/* Left and right visual borders */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-muted/10" />
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-muted/10" />
        
        {/* Visible handles like group nodes */}
        <Handle 
          type="target" 
          position={Position.Left}
          className="!w-4 !h-4 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all !z-10"
          style={{ 
            left: '-8px',
            background: isBoundary 
              ? 'linear-gradient(135deg, var(--node-boundary), color-mix(in oklch, var(--node-boundary), white 20%))' 
              : 'linear-gradient(135deg, var(--node-contact), color-mix(in oklch, var(--node-contact), white 20%))'
          }}
        />
        <Handle 
          type="source" 
          position={Position.Right}
          className="!w-4 !h-4 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all !z-10"
          style={{ 
            right: '-8px',
            background: isBoundary 
              ? 'linear-gradient(135deg, var(--node-boundary), color-mix(in oklch, var(--node-boundary), white 20%))' 
              : 'linear-gradient(135deg, var(--node-contact), color-mix(in oklch, var(--node-contact), white 20%))'
          }}
        />
        
        {/* Content */}
        <div className="absolute inset-0 flex items-center justify-center px-[10px]">
          {/* Blend mode indicator */}
          {blendMode === 'merge' && (
            <div className="absolute top-0.5 right-1.5 z-10">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 ring-1 ring-green-400/50" />
            </div>
          )}
          
          {/* Main content area */}
          <div className={cn(
            "text-[9px] leading-[1.1] font-mono text-center break-all select-none overflow-hidden",
            "max-h-[32px] line-clamp-3",
            lastContradiction ? 'text-red-500 font-bold' : content === undefined ? 'text-muted-foreground' : 'text-foreground'
          )}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word'
          }}
          title={lastContradiction?.reason || (content !== undefined ? String(content) : undefined)}>
            {lastContradiction ? '⚠' : content !== undefined ? String(content) : '∅'}
          </div>
        </div>
      </Card>
    
    {/* Context Menu - Portal to document body */}
    {showContextMenu && createPortal(
      <>
        {/* Invisible backdrop to close menu */}
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={() => setShowContextMenu(false)}
        />
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
        <div className="border-t my-1" />
        <button
          className="flex w-full items-center justify-between px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
          onClick={() => {
            setBlendMode(blendMode === 'merge' ? 'accept-last' : 'merge')
            setShowContextMenu(false)
          }}
        >
          <span>Blend Mode</span>
          <span className="text-xs opacity-70">
            {blendMode === 'merge' ? 'Merge' : 'Accept Last'}
          </span>
        </button>
      </div>
      </>,
      document.body
    )}
    </>
  )
})