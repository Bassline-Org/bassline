import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useSubmit } from 'react-router'
import { useContact } from '~/hooks/useWorkerData'
import type { Contact } from '~/propagation-core-v2/types'

interface DemoContactNodeProps {
  id: string
  data: {
    contact: Contact
    groupId: string
  }
}

export function DemoContactNode({ id, data }: DemoContactNodeProps) {
  const { contact: liveContact, loading } = useContact(id, data.contact)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const submit = useSubmit()
  
  const contact = liveContact || data.contact
  
  const handleStartEdit = () => {
    setEditValue(String(contact.content || ''))
    setIsEditing(true)
  }
  
  const handleSaveEdit = () => {
    if (editValue !== String(contact.content)) {
      submit({
        intent: 'update-contact',
        contactId: contact.id,
        content: JSON.stringify(editValue),
      }, {
        method: 'post',
        action: '/api/demo',
        navigate: false
      })
    }
    setIsEditing(false)
  }
  
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditValue('')
  }
  
  const handleDelete = () => {
    if (confirm('Delete this contact?')) {
      submit({
        intent: 'delete-contact',
        contactId: contact.id,
      }, {
        method: 'post',
        action: '/api/demo',
        navigate: false
      })
    }
  }
  
  if (loading) {
    return (
      <div className="bg-gray-200 border-2 border-gray-300 rounded-lg p-3 min-w-32">
        <div className="text-center text-gray-500">Loading...</div>
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }
  
  // Check if this is a boundary contact in a primitive gadget
  const isGadgetBoundary = contact.isBoundary && data.isGadget
  
  return (
    <div className={`border-2 rounded-lg p-3 min-w-32 shadow-sm ${
      isGadgetBoundary 
        ? 'bg-purple-50 border-purple-400' 
        : contact.blendMode === 'merge'
        ? 'bg-green-50 border-green-400'
        : 'bg-white border-blue-300'
    }`}>
      <Handle type="target" position={Position.Left} />
      
      <div className="text-center">
        <div className="text-xs text-gray-500 mb-1">
          {contact.blendMode} | {contact.id.slice(0, 6)}
          {isGadgetBoundary && ' | gadget'}
        </div>
        
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit()
                if (e.key === 'Escape') handleCancelEdit()
              }}
            />
            <div className="flex gap-1">
              <button
                onClick={handleSaveEdit}
                className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div 
              className="font-medium cursor-pointer hover:bg-gray-50 p-1 rounded"
              onClick={handleStartEdit}
              title="Click to edit"
            >
              {String(contact.content || 'Empty')}
            </div>
            <button
              onClick={handleDelete}
              className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        )}
        
        {contact.lastContradiction && (
          <div className="text-xs text-red-500 mt-1 bg-red-50 p-1 rounded">
            Contradiction: {contact.lastContradiction.message}
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} />
    </div>
  )
}