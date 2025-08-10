/**
 * StyledContactNode - Contact node with old v1 visual styling
 * Compact 60x40px design with gradients and animations
 */

import { memo, useCallback, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useFetcher } from 'react-router'
import { motion } from 'framer-motion'
import { cn } from '~/lib/utils'

export interface ContactNodeData {
  content?: any
  blendMode?: 'accept-last' | 'merge'
  isBoundary?: boolean
  contactId?: string
  groupId?: string
}

export const StyledContactNode = memo(({ id, data, selected }: NodeProps) => {
  const fetcher = useFetcher()
  const { content, blendMode = 'accept-last', isBoundary = false, contactId, groupId } = data as ContactNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  
  // Format content for display
  const formatContent = (value: unknown) => {
    if (value === undefined || value === null) return '∅'
    if (typeof value === 'string') return value || '""'
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return value ? 'T' : 'F'
    if (Array.isArray(value)) return `[${value.length}]`
    if (typeof value === 'object') return '{...}'
    return String(value)
  }
  
  // Format for tooltip
  const formatTooltip = (value: unknown) => {
    if (value === undefined || value === null) return 'undefined'
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return JSON.stringify(value)
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }
  
  // Get raw content for editing
  const getRawContent = (value: unknown) => {
    if (value === undefined || value === null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return JSON.stringify(value)
  }
  
  const displayContent = formatContent(content)
  const tooltipContent = formatTooltip(content)
  
  // Handle starting edit
  const handleStartEdit = useCallback(() => {
    setIsEditing(true)
    setEditValue(getRawContent(content))
  }, [content])
  
  // Handle save edit
  const handleSaveEdit = useCallback(() => {
    if (!contactId || !groupId) return
    
    // Parse the value based on content
    let parsedValue: any = editValue
    
    // Try to parse as JSON first
    if (editValue.startsWith('{') || editValue.startsWith('[')) {
      try {
        parsedValue = JSON.parse(editValue)
      } catch (e) {
        // Keep as string if JSON parse fails
      }
    } else if (editValue === 'true' || editValue === 'false') {
      parsedValue = editValue === 'true'
    } else if (!isNaN(Number(editValue)) && editValue !== '') {
      parsedValue = Number(editValue)
    }
    
    // Submit update to network
    fetcher.submit(
      {
        intent: 'update-contact',
        contactId,
        groupId,
        value: JSON.stringify(parsedValue)
      },
      { method: 'post' }
    )
    
    setIsEditing(false)
  }, [editValue, contactId, groupId, fetcher])
  
  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue('')
  }, [])
  
  // Node type for styling
  const nodeType = isBoundary ? 'boundary' : 'contact'
  
  return (
    <>
      {/* Handles positioned outside the node */}
      <Handle 
        type="target" 
        position={Position.Left}
        className="!w-4 !h-4 !rounded-sm !border !border-border !shadow-sm hover:!shadow-md !transition-all !z-10"
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
        className="!w-4 !h-4 !rounded-sm !border !border-border !shadow-sm hover:!shadow-md !transition-all !z-10"
        style={{ 
          right: '-8px',
          background: isBoundary 
            ? 'linear-gradient(135deg, var(--node-boundary), color-mix(in oklch, var(--node-boundary), white 20%))' 
            : 'linear-gradient(135deg, var(--node-contact), color-mix(in oklch, var(--node-contact), white 20%))'
        }}
      />
      
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: selected ? 1.1 : 1, 
          opacity: 1
        }}
        whileHover={{ scale: selected ? 1.1 : 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{
          scale: { type: "spring", stiffness: 400, damping: 20 },
          opacity: { duration: 0.2 }
        }}
      >
        <div 
          className={cn(
            "w-[60px] h-[40px] rounded transition-all shadow-sm hover:shadow-md relative",
            nodeType === 'boundary' ? 'node-gradient-boundary node-border-boundary' : 'node-gradient-contact node-border-contact',
            selected && (nodeType === 'boundary' ? 'ring-2 node-ring-boundary' : 'ring-2 node-ring-contact')
          )}
          title={tooltipContent}
        >
          {/* Left and right visual borders */}
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-muted/10 rounded-l" />
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-muted/10 rounded-r" />
          
          {/* Content area */}
          <div className="absolute inset-0 flex items-center justify-center px-[10px]">
            {/* Blend mode indicator */}
            {blendMode === 'merge' && (
              <div className="absolute top-0.5 right-1.5 z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 ring-1 ring-green-400/50" />
              </div>
            )}
            
            {/* Main content */}
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    handleSaveEdit()
                  } else if (e.key === 'Escape') {
                    handleCancelEdit()
                  }
                }}
                className="w-full h-[24px] px-1 text-[9px] font-mono text-center bg-background border rounded"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div 
                className={cn(
                  "text-[9px] leading-[1.1] font-mono text-center break-all select-none overflow-hidden cursor-text",
                  "max-h-[32px]",
                  content === undefined ? 'text-muted-foreground' : 'text-foreground'
                )}
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word'
                }}
                onDoubleClick={handleStartEdit}
              >
                {displayContent}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
})

StyledContactNode.displayName = 'StyledContactNode'