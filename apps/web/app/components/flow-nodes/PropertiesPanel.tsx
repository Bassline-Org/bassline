import { useState, useEffect } from 'react'
import { useFetcher } from 'react-router'
import { X, ChevronRight } from 'lucide-react'

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
  const [editingValue, setEditingValue] = useState<string>('')
  const [editingBlendMode, setEditingBlendMode] = useState<string>('accept-last')
  
  // Get selected node if only one is selected
  const selectedNode = selectedNodes.length === 1 
    ? nodes.find(n => n.id === selectedNodes[0])
    : null
    
  // Get selected edge if only one is selected
  const selectedEdge = selectedEdges.length === 1
    ? edges.find(e => e.id === selectedEdges[0])
    : null
    
  // Update editing values when selection changes
  useEffect(() => {
    if (selectedNode?.type === 'contact') {
      setEditingValue(JSON.stringify(selectedNode.data.content || ''))
      setEditingBlendMode(selectedNode.data.blendMode || 'accept-last')
    }
  }, [selectedNode])
  
  const handleUpdateContact = () => {
    if (selectedNode?.type === 'contact') {
      let parsedValue: any = editingValue
      try {
        parsedValue = JSON.parse(editingValue)
      } catch {
        // If parsing fails, treat as string
        parsedValue = editingValue
      }
      
      fetcher.submit(
        {
          intent: 'update-contact',
          contactId: selectedNode.data.contactId || selectedNode.id,
          groupId: selectedNode.data.groupId || groupId,
          value: JSON.stringify(parsedValue)
        },
        { method: 'post' }
      )
    }
  }
  
  const handleUpdateBlendMode = () => {
    if (selectedNode?.type === 'contact') {
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
            {selectedNode?.type === 'contact' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Contact ID
                  </label>
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {selectedNode.id.slice(0, 8)}...
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Content
                  </label>
                  <textarea
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleUpdateContact}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    rows={3}
                  />
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
                
                {selectedNode.data.isBoundary && (
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