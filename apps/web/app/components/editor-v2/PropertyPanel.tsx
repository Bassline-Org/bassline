import { useEffect, useState } from 'react'
import { useSubmit } from 'react-router'
import type { Contact } from '@bassline/core'

interface PropertyPanelProps {
  selectedNodes: string[]
  nodes: any[] // React Flow nodes
  onClose: () => void
}

export function PropertyPanel({ selectedNodes, nodes, onClose }: PropertyPanelProps) {
  const submit = useSubmit()
  const [content, setContent] = useState('')
  const [blendMode, setBlendMode] = useState<'accept-last' | 'merge'>('accept-last')
  
  // Get the selected contact
  const selectedContact = selectedNodes.length === 1 
    ? nodes.find(n => n.id === selectedNodes[0] && n.type === 'contact')
    : null
    
  useEffect(() => {
    if (selectedContact?.data.contact) {
      const contact = selectedContact.data.contact as Contact
      setContent(
        typeof contact.content === 'string' 
          ? contact.content 
          : JSON.stringify(contact.content)
      )
      setBlendMode(contact.blendMode)
    }
  }, [selectedContact])
  
  if (selectedNodes.length === 0) {
    return null
  }
  
  if (selectedNodes.length > 1) {
    return (
      <div className="absolute right-4 top-20 w-80 bg-white rounded-lg shadow-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Properties</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <p className="text-gray-600">Multiple nodes selected ({selectedNodes.length})</p>
      </div>
    )
  }
  
  if (!selectedContact) {
    return (
      <div className="absolute right-4 top-20 w-80 bg-white rounded-lg shadow-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Properties</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <p className="text-gray-600">Select a contact to edit properties</p>
      </div>
    )
  }
  
  const handleSave = () => {
    try {
      // Try to parse as JSON
      const parsedContent = JSON.parse(content)
      submit({
        intent: 'update-contact',
        contactId: selectedContact.id,
        content: content
      }, {
        method: 'post',
        action: '/api/editor/actions',
        navigate: false
      })
    } catch {
      // If not valid JSON, save as string
      submit({
        intent: 'update-contact',
        contactId: selectedContact.id,
        content: JSON.stringify(content)
      }, {
        method: 'post',
        action: '/api/editor/actions',
        navigate: false
      })
    }
  }
  
  return (
    <div className="absolute right-4 top-20 w-80 bg-white rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Contact Properties</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ID
          </label>
          <input
            type="text"
            value={selectedContact.id}
            disabled
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Enter JSON or string value..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Blend Mode
          </label>
          <select
            value={blendMode}
            onChange={(e) => setBlendMode(e.target.value as 'accept-last' | 'merge')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            disabled
          >
            <option value="accept-last">Accept Last</option>
            <option value="merge">Merge</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Blend mode cannot be changed after creation
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}