import { useState, useEffect } from 'react'
import { useFetcher } from 'react-router'
import { X, ChevronRight } from 'lucide-react'
import { NumberEditor } from './property-editors/NumberEditor'
import { BooleanEditor } from './property-editors/BooleanEditor'
import { StringEditor } from './property-editors/StringEditor'
import { ArrayEditor } from './property-editors/ArrayEditor'
import { ObjectEditor } from './property-editors/ObjectEditor'

interface PropertiesPanelProps {
  selectedNodes: string[]
  selectedEdges: string[]
  nodes: any[]
  edges: any[]
  groupId: string
  isVisible: boolean
  onToggleVisibility: () => void
}

export function PropertiesPanel({
  selectedNodes,
  selectedEdges,
  nodes,
  edges,
  groupId,
  isVisible,
  onToggleVisibility
}: PropertiesPanelProps) {
  const fetcher = useFetcher()
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<any>(null)
  const [editingBlendMode, setEditingBlendMode] = useState<string>('accept-last')
  
  // Get the node being edited (persists until a new node is selected)
  const editingNode = editingNodeId ? nodes.find(n => n.id === editingNodeId) : null
  
  // Get selected node if only one is selected
  const selectedNode = selectedNodes.length === 1 
    ? nodes.find(n => n.id === selectedNodes[0])
    : null
    
  // Get selected edge if only one is selected
  const selectedEdge = selectedEdges.length === 1
    ? edges.find(e => e.id === selectedEdges[0])
    : null
    
  // Update editing node when selection changes to a different single node
  useEffect(() => {
    // Don't update if we're in the middle of a form submission
    if (fetcher.state !== 'idle') {
      return
    }
    
    if (selectedNode && selectedNode.id !== editingNodeId) {
      setEditingNodeId(selectedNode.id)
      if (selectedNode.type === 'contact') {
        setEditingValue(selectedNode.data.content ?? '')
        setEditingBlendMode(selectedNode.data.blendMode || 'accept-last')
      }
    } else if (selectedNodes.length === 0) {
      // Clear editing when nothing is selected
      setEditingNodeId(null)
    }
  }, [selectedNode, selectedNodes.length, editingNodeId, fetcher.state])
  
  // Update the editing node's data when it changes (e.g., from network updates)
  useEffect(() => {
    if (editingNode?.type === 'contact' && editingNode.data.content !== editingValue) {
      // Only update if the content actually changed from external source
      // This prevents overwriting user edits
    }
  }, [editingNode])
  
  const handleUpdateContact = (newValue: any) => {
    if (editingNode?.type === 'contact') {
      setEditingValue(newValue)
      fetcher.submit(
        {
          intent: 'update-contact',
          contactId: editingNode.data.contactId || editingNode.id,
          groupId: editingNode.data.groupId || groupId,
          value: JSON.stringify(newValue)
        },
        { method: 'post' }
      )
    }
  }
  
  const handleTypeChange = (newType: string) => {
    if (editingNode?.type === 'contact') {
      // Convert the current value to the new type
      let convertedValue: any = editingValue
      
      switch (newType) {
        case 'number':
          convertedValue = Number(editingValue) || 0
          break
        case 'boolean':
          convertedValue = Boolean(editingValue)
          break
        case 'string':
          convertedValue = String(editingValue)
          break
        case 'array':
          convertedValue = Array.isArray(editingValue) ? editingValue : []
          break
        case 'object':
          convertedValue = typeof editingValue === 'object' && !Array.isArray(editingValue) 
            ? editingValue 
            : {}
          break
        case 'null':
          convertedValue = null
          break
      }
      
      setEditingValue(convertedValue)
      handleUpdateContact(convertedValue)
      
      // TODO: Also save the valueType preference on the node
    }
  }
  
  // Determine the type of the content for selecting the right editor
  const getContentType = (value: any): string => {
    if (editingNode?.data?.valueType) {
      return editingNode.data.valueType
    }
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string') return 'string'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') return 'object'
    return 'unknown'
  }
  
  const renderValueEditor = () => {
    const type = getContentType(editingValue)
    
    switch (type) {
      case 'number':
        return (
          <NumberEditor
            value={editingValue as number}
            onChange={handleUpdateContact}
          />
        )
      case 'boolean':
        return (
          <BooleanEditor
            value={editingValue as boolean}
            onChange={handleUpdateContact}
          />
        )
      case 'string':
        return (
          <StringEditor
            value={editingValue as string}
            onChange={handleUpdateContact}
            multiline={editingValue.length > 50}
          />
        )
      case 'array':
        return (
          <ArrayEditor
            value={editingValue as any[]}
            onChange={handleUpdateContact}
          />
        )
      case 'object':
        return (
          <ObjectEditor
            value={editingValue as Record<string, any>}
            onChange={handleUpdateContact}
          />
        )
      case 'null':
        return (
          <div className="text-sm text-gray-500 italic">null</div>
        )
      default:
        return (
          <textarea
            value={JSON.stringify(editingValue, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleUpdateContact(parsed)
              } catch {
                // Invalid JSON, don't update
              }
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono"
            rows={3}
            placeholder="Enter JSON..."
          />
        )
    }
  }
  
  const handleUpdateBlendMode = () => {
    if (editingNode?.type === 'contact') {
      // TODO: Add blend mode update support
      console.log('Update blend mode to:', editingBlendMode)
    }
  }
  
  const handleDeleteWire = () => {
    if (selectedEdge) {
      fetcher.submit(
        {
          intent: 'delete-edge',
          edgeId: selectedEdge.id
        },
        { method: 'post' }
      )
    }
  }
  
  return (
    <div
      className={`absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-all ${
        isVisible ? 'w-80' : 'w-12'
      }`}
    >
      {isVisible ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm">Properties</h3>
            <button
              onClick={onToggleVisibility}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-3">
            {editingNode?.type === 'contact' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Contact ID
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {editingNode.id.slice(0, 8)}...
                    </div>
                    {editingNodeId !== selectedNode?.id && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        (editing)
                      </span>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">
                      Content
                    </label>
                    <select
                      value={getContentType(editingValue)}
                      onChange={(e) => handleTypeChange(e.target.value)}
                      className="text-xs px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="array">Array</option>
                      <option value="object">Object</option>
                      <option value="null">Null</option>
                    </select>
                  </div>
                  {renderValueEditor()}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Blend Mode
                  </label>
                  <select
                    value={editingBlendMode}
                    onChange={(e) => setEditingBlendMode(e.target.value)}
                    onBlur={handleUpdateBlendMode}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  >
                    <option value="accept-last">Accept Last</option>
                    <option value="merge">Merge</option>
                    <option value="append">Append</option>
                  </select>
                </div>
                
                {editingNode.data.isBoundary && (
                  <div className="text-sm text-blue-600 dark:text-blue-400">
                    ⚡ Boundary Contact
                  </div>
                )}
              </div>
            )}
            
            {selectedNode?.type === 'group' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Group Name
                  </label>
                  <div className="text-sm">
                    {selectedNode.data.name}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Group ID
                  </label>
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {selectedNode.id.slice(0, 8)}...
                  </div>
                </div>
                
                {selectedNode.data.isGadget && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Primitive Type
                    </label>
                    <div className="text-sm text-purple-600 dark:text-purple-400">
                      {selectedNode.data.primitiveId}
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Inputs
                  </label>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedNode.data.inputContacts?.length || 0} contacts
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Outputs
                  </label>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedNode.data.outputContacts?.length || 0} contacts
                  </div>
                </div>
              </div>
            )}
            
            {selectedEdge && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Wire ID
                  </label>
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {selectedEdge.id.slice(0, 8)}...
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Type
                  </label>
                  <div className="text-sm">
                    {selectedEdge.type === 'straight' ? 'Directed' : 'Bidirectional'}
                  </div>
                </div>
                
                <button
                  onClick={handleDeleteWire}
                  className="w-full px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
                >
                  Delete Wire
                </button>
              </div>
            )}
            
            {selectedNodes.length > 1 && (
              <div className="text-sm text-gray-500">
                {selectedNodes.length} nodes selected
              </div>
            )}
            
            {selectedEdges.length > 1 && (
              <div className="text-sm text-gray-500">
                {selectedEdges.length} edges selected
              </div>
            )}
            
            {selectedNodes.length === 0 && selectedEdges.length === 0 && (
              <div className="text-sm text-gray-500">
                Select a node or edge to view properties
              </div>
            )}
          </div>
        </>
      ) : (
        <button
          onClick={onToggleVisibility}
          className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg w-full h-full flex items-center justify-center"
          title="Show Properties"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}