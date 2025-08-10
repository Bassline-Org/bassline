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
  const { content, blendMode = 'accept-last', isBoundary = false, groupId } = data as ContactNodeData
  
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
  
  const displayContent = formatContent(content)
  const tooltipContent = formatTooltip(content)
  
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
            <div 
              className={cn(
                "text-[9px] leading-[1.1] font-mono text-center break-all select-none overflow-hidden",
                "max-h-[32px]",
                content === undefined ? 'text-muted-foreground' : 'text-foreground'
              )}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word'
              }}
            >
              {displayContent}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
})

StyledContactNode.displayName = 'StyledContactNode'