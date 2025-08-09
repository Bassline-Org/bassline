import { memo, useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useNavigate } from 'react-router'

export interface GroupNodeData {
  groupId: string
  parentGroupId: string
  name: string
  isGadget?: boolean
  primitiveId?: string
  boundaryContacts?: Array<{
    id: string
    name: string
    boundaryDirection: 'input' | 'output'
  }>
  [key: string]: unknown // Allow additional properties for React Flow
}

export const GroupNodeV2 = memo(({ data, selected }: NodeProps) => {
  const navigate = useNavigate()
  const { groupId, name, isGadget, primitiveId, boundaryContacts = [] } = data as GroupNodeData
  
  // Debug log for boundary contacts
  if (isGadget) {
    console.log(`[GroupNodeV2] Gadget ${name} (${groupId}) boundary contacts:`, boundaryContacts)
  }
  
  const handleDoubleClick = useCallback(() => {
    // Only navigate into non-gadget groups
    if (!isGadget) {
      navigate(`/editor/${groupId}`)
    }
  }, [groupId, navigate, isGadget])
  
  // Different styling for gadgets vs regular groups
  const bgColor = isGadget ? 'bg-orange-50' : 'bg-purple-50'
  const borderColor = selected 
    ? (isGadget ? 'border-orange-500' : 'border-purple-500')
    : (isGadget ? 'border-orange-300' : 'border-purple-300')
  const textColor = isGadget ? 'text-orange-700' : 'text-purple-700'
  const handleColor = isGadget ? '!bg-orange-400' : '!bg-purple-400'
  
  // Separate boundary contacts by direction
  const inputContacts = boundaryContacts.filter((c: any) => c.boundaryDirection === 'input')
  const outputContacts = boundaryContacts.filter((c: any) => c.boundaryDirection === 'output')
  
  return (
    <div 
      className={`
        relative min-w-[150px] min-h-[60px] p-3 rounded-lg border-2 
        ${borderColor} ${bgColor} ${selected ? 'shadow-lg' : ''}
        hover:shadow-md transition-shadow cursor-pointer
      `}
      onDoubleClick={handleDoubleClick}
    >
      {/* Input handles for gadgets */}
      {isGadget && inputContacts.map((contact: any, index: number) => (
        <Handle
          key={contact.id}
          id={contact.id}
          type="target"
          position={Position.Left}
          style={{ top: `${(index + 1) * (100 / (inputContacts.length + 1))}%` }}
          className={`!w-3 !h-3 ${handleColor} !border-2 !border-white`}
          title={contact.name}
        />
      ))}
      
      {/* Default target handle for regular groups */}
      {!isGadget && (
        <Handle
          type="target"
          position={Position.Left}
          className={`!w-3 !h-3 ${handleColor} !border-2 !border-white`}
        />
      )}
      
      <div className={`text-sm font-semibold ${textColor}`}>
        {isGadget && '⚡ '}{name}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {isGadget ? `Primitive: ${primitiveId}` : 'Double-click to enter'}
      </div>
      
      {/* Show input/output labels for gadgets */}
      {isGadget && inputContacts.length > 0 && (
        <div className="absolute left-[-30px] top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {inputContacts.map((c: any, i: number) => (
            <div key={c.id} style={{ position: 'absolute', top: `${(i + 1) * (100 / (inputContacts.length + 1)) - 50}%` }}>
              {c.name}
            </div>
          ))}
        </div>
      )}
      
      {isGadget && outputContacts.length > 0 && (
        <div className="absolute right-[-30px] top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {outputContacts.map((c: any, i: number) => (
            <div key={c.id} style={{ position: 'absolute', top: `${(i + 1) * (100 / (outputContacts.length + 1)) - 50}%` }}>
              {c.name}
            </div>
          ))}
        </div>
      )}
      
      {/* Output handles for gadgets */}
      {isGadget && outputContacts.map((contact: any, index: number) => (
        <Handle
          key={contact.id}
          id={contact.id}
          type="source"
          position={Position.Right}
          style={{ top: `${(index + 1) * (100 / (outputContacts.length + 1))}%` }}
          className={`!w-3 !h-3 ${handleColor} !border-2 !border-white`}
          title={contact.name}
        />
      ))}
      
      {/* Default source handle for regular groups */}
      {!isGadget && (
        <Handle
          type="source"
          position={Position.Right}
          className={`!w-3 !h-3 ${handleColor} !border-2 !border-white`}
        />
      )}
    </div>
  )
})

GroupNodeV2.displayName = 'GroupNodeV2'