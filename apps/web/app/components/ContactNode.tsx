/**
 * ContactNode - Simple contact display for micro-bassline network
 */

import { memo, useState, useCallback, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export interface ContactNodeData {
  contact: any
  contactId: string
  groupId: string
  sendAction: (action: any) => void
}

export const ContactNode = memo(({ data, selected }: NodeProps<ContactNodeData>) => {
  const { contact, contactId, groupId, sendAction } = data
  const [localValue, setLocalValue] = useState(contact?.content || '')
  const [isEditing, setIsEditing] = useState(false)
  
  // Update local value when contact changes
  useEffect(() => {
    if (!isEditing && contact?.content !== undefined) {
      setLocalValue(contact.content)
    }
  }, [contact?.content, isEditing])
  
  // Format value for display
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    return JSON.stringify(value)
  }
  
  // Handle value change
  const handleValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }, [])
  
  // Submit value to network
  const handleSubmit = useCallback(() => {
    let parsedValue = localValue
    
    // Try to parse as JSON
    try {
      parsedValue = JSON.parse(localValue)
    } catch {
      // If not valid JSON, treat as string
      // Try to parse as number if it looks like one
      if (/^-?\d+(\.\d+)?$/.test(localValue)) {
        parsedValue = parseFloat(localValue)
      }
    }
    
    // Send setValue action to network
    // Format: groupId:contactId for qualified ID
    sendAction(['setValue', `${groupId}:${contactId}`, parsedValue])
    setIsEditing(false)
  }, [localValue, groupId, contactId, sendAction])
  
  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setLocalValue(formatValue(contact?.content))
      setIsEditing(false)
    }
  }, [handleSubmit, contact])
  
  return (
    <div 
      className={`
        bg-white border-2 rounded-lg p-3 min-w-[150px]
        ${selected ? 'border-blue-500 shadow-lg' : 'border-gray-300'}
        ${contact?.properties?.isBoundary ? 'border-dashed' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-400"
      />
      
      {/* Contact Name */}
      <div className="text-xs font-bold text-gray-600 mb-1">
        {contactId}
      </div>
      
      {/* Contact Value */}
      {isEditing ? (
        <input
          type="text"
          value={localValue}
          onChange={handleValueChange}
          onBlur={handleSubmit}
          onKeyDown={handleKeyPress}
          className="w-full px-2 py-1 text-sm border rounded"
          autoFocus
        />
      ) : (
        <div
          onClick={() => {
            setIsEditing(true)
            setLocalValue(formatValue(contact?.content))
          }}
          className="px-2 py-1 text-sm bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
        >
          {formatValue(contact?.content) || <span className="text-gray-400">empty</span>}
        </div>
      )}
      
      {/* Blend Mode Indicator */}
      {contact?.properties?.blendMode && (
        <div className="text-xs text-gray-500 mt-1">
          {contact.properties.blendMode}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-400"
      />
    </div>
  )
})