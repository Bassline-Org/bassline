/**
 * StyledGroupNode - Group/gadget node with old v1 visual styling
 * Card-based design with gradients and 3D animations
 */

import { memo, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useNavigate, useParams } from 'react-router'
import { motion } from 'framer-motion'
import { Package, Lock } from 'lucide-react'
import { cn } from '~/lib/utils'

export interface GroupNodeData {
  groupId: string
  name: string
  isGadget?: boolean
  primitiveId?: string
  inputContacts?: Array<{
    id: string
    name: string
  }>
  outputContacts?: Array<{
    id: string
    name: string
  }>
}

export const StyledGroupNode = memo(({ id, data, selected }: NodeProps) => {
  const navigate = useNavigate()
  const params = useParams()
  const { 
    groupId, 
    name, 
    isGadget = false, 
    primitiveId,
    inputContacts = [],
    outputContacts = []
  } = data as GroupNodeData
  
  const handleDoubleClick = useCallback(() => {
    // Only navigate into non-gadget groups
    if (!isGadget) {
      console.log('[StyledGroupNode] Navigating into group:', groupId)
      navigate(`/flow/session/${params.sessionId}/group/${groupId}`)
    }
  }, [groupId, params.sessionId, navigate, isGadget])
  
  // Different styling for gadgets vs regular groups
  const nodeType = isGadget ? 'primitive' : 'group'
  const maxContacts = Math.max(inputContacts.length, outputContacts.length, 1)
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, rotateY: 90 }}
      animate={{ 
        scale: selected ? 1.05 : 1,
        opacity: 1,
        rotateY: 0
      }}
      whileHover={{ scale: selected ? 1.05 : 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        scale: { type: "spring", stiffness: 300, damping: 25 },
        opacity: { duration: 0.2 },
        rotateY: { type: "spring", stiffness: 260, damping: 20 }
      }}
      style={{ 
        transformStyle: "preserve-3d",
        ...(isGadget ? { width: 60, height: 60 } : {})
      }}
      onDoubleClick={handleDoubleClick}
    >
      <div 
        className={cn(
          "transition-all shadow-md hover:shadow-lg rounded-lg",
          nodeType === 'primitive' 
            ? 'node-gradient-primitive node-border-primitive w-fit' 
            : 'node-gradient-group node-border-group min-w-[200px]',
          selected && (nodeType === 'primitive' ? 'ring-2 node-ring-primitive' : 'ring-2 node-ring-group'),
          !isGadget && 'cursor-pointer'
        )}
      >
        {isGadget ? (
          // Primitive gadgets - compact icon view
          <div className="p-[5px] flex items-center justify-center w-[50px] h-[50px]">
            <div className="text-2xl">⚡</div>
          </div>
        ) : (
          // Regular groups - full card view
          <>
            <div className="p-3 pb-2 border-b border-current border-opacity-20">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[var(--node-group)]" />
                <div className="font-semibold text-sm select-none">{name}</div>
              </div>
            </div>
            <div className="flex" style={{ minHeight: `${maxContacts * 28}px` }}>
              {/* Input contacts (left side) */}
              <div className="flex-1 flex flex-col border-r border-current border-opacity-20">
                {inputContacts.map((contact, index) => (
                  <div key={contact.id} className="relative flex items-center h-7">
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={contact.id}
                      className="!w-6 !h-6 !rounded-sm !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                      style={{ 
                        left: '-12px',
                        background: 'linear-gradient(135deg, var(--node-group), color-mix(in oklch, var(--node-group), white 20%))'
                      }}
                    />
                    <div className="pl-3 pr-2 w-full">
                      <span className="text-xs font-medium opacity-80 select-none">{contact.name || `in${index + 1}`}</span>
                    </div>
                  </div>
                ))}
                {inputContacts.length === 0 && (
                  <div className="flex-1 flex items-center justify-center min-h-[40px]">
                    <span className="text-xs italic opacity-50 select-none">no inputs</span>
                  </div>
                )}
              </div>
              
              {/* Output contacts (right side) */}
              <div className="flex-1 flex flex-col">
                {outputContacts.map((contact, index) => (
                  <div key={contact.id} className="relative flex items-center justify-end h-7">
                    <div className="pl-2 pr-3 w-full text-right">
                      <span className="text-xs font-medium opacity-80 select-none">{contact.name || `out${index + 1}`}</span>
                    </div>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={contact.id}
                      className="!w-6 !h-6 !rounded-sm !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                      style={{ 
                        right: '-12px',
                        background: 'linear-gradient(135deg, var(--node-group), color-mix(in oklch, var(--node-group), white 20%))'
                      }}
                    />
                  </div>
                ))}
                {outputContacts.length === 0 && (
                  <div className="flex-1 flex items-center justify-center min-h-[40px]">
                    <span className="text-xs italic opacity-50 select-none">no outputs</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        
        {/* Primitive gadget handles positioned around the icon */}
        {isGadget && (
          <>
            {/* Input handles */}
            {inputContacts.map((contact, index) => (
              <Handle
                key={contact.id}
                type="target"
                position={Position.Left}
                id={contact.id}
                className="!w-5 !h-5 !rounded-sm !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                style={{ 
                  left: '-10px',
                  top: `${15 + index * 20}px`,
                  background: 'linear-gradient(135deg, var(--node-primitive), color-mix(in oklch, var(--node-primitive), white 20%))'
                }}
                title={contact.name || `in${index + 1}`}
              />
            ))}
            
            {/* Output handles */}
            {outputContacts.map((contact, index) => (
              <Handle
                key={contact.id}
                type="source"
                position={Position.Right}
                id={contact.id}
                className="!w-5 !h-5 !rounded-sm !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                style={{ 
                  right: '-10px',
                  top: `${15 + index * 20}px`,
                  background: 'linear-gradient(135deg, var(--node-primitive), color-mix(in oklch, var(--node-primitive), white 20%))'
                }}
                title={contact.name || `out${index + 1}`}
              />
            ))}
          </>
        )}
      </div>
    </motion.div>
  )
})

StyledGroupNode.displayName = 'StyledGroupNode'