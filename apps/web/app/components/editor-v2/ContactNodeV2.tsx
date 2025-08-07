import { memo, useCallback, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useSubmit } from 'react-router'
import type { Contact } from '@bassline/core'

export interface ContactNodeData {
  contact: Contact
  groupId: string
  [key: string]: unknown // Allow additional properties for React Flow
}

export const ContactNodeV2 = memo(({ data, selected }: NodeProps) => {
  const submit = useSubmit()
  const { contact, groupId } = data as ContactNodeData
  
  // Format content for display
  const formatContent = (content: unknown) => {
    if (typeof content === 'string') {
      return content
    } else if (content === null || content === undefined) {
      return ''
    } else {
      return JSON.stringify(content)
    }
  }
  
  // Use local state for the input value
  const [inputValue, setInputValue] = useState(formatContent(contact.content))
  
  // Update local state when contact content changes
  useEffect(() => {
    setInputValue(formatContent(contact.content))
  }, [contact.content])
  
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }, [])
  
  const handleContentSubmit = useCallback(() => {
    const newContent = inputValue
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(newContent)
      submit({
        intent: 'update-contact',
        contactId: contact.id,
        content: newContent
      }, {
        method: 'post',
        action: '/api/editor-v2/actions',
        navigate: false
      })
    } catch {
      // If not valid JSON, save as string
      submit({
        intent: 'update-contact',
        contactId: contact.id,
        content: JSON.stringify(newContent)
      }, {
        method: 'post',
        action: '/api/editor-v2/actions',
        navigate: false
      })
    }
  }, [contact.id, submit, inputValue])
  
  return (
    <div 
      className={`
        relative min-w-[120px] min-h-[40px] p-2 rounded-lg border-2 
        ${selected ? 'border-blue-500 shadow-lg' : 'border-gray-300'}
        bg-white hover:shadow-md transition-shadow
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      
      <div className="text-xs text-gray-500 mb-1">{contact.id}</div>
      
      <input
        type="text"
        value={inputValue}
        onChange={handleContentChange}
        onBlur={handleContentSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
        className="w-full px-1 py-0.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
        placeholder="Enter value..."
      />
      
      <div className="text-xs text-gray-400 mt-1">
        {contact.blendMode === 'merge' ? '🔀' : '📌'} {contact.blendMode}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  )
})

ContactNodeV2.displayName = 'ContactNodeV2'