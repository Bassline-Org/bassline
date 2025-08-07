import { useEffect, useRef } from 'react'
import { useSubmit } from 'react-router'

interface ContextMenuProps {
  x: number
  y: number
  selectedNodes: string[]
  nodes: any[]
  groupId: string
  onClose: () => void
}

export function ContextMenu({ x, y, selectedNodes, nodes, groupId, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const submit = useSubmit()
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])
  
  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])
  
  // Get selected contact nodes only (not groups)
  const selectedContactIds = selectedNodes.filter(nodeId => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.type === 'contact' || node?.type === 'slider'
  })
  
  // Get selected group nodes
  const selectedGroupIds = selectedNodes.filter(nodeId => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.type === 'group'
  })
  
  const handleExtractToGroup = () => {
    if (selectedContactIds.length === 0) return
    
    const groupName = prompt('Enter group name:', 'New Group')
    if (!groupName) return
    
    submit({
      intent: 'extract-to-group',
      contactIds: JSON.stringify(selectedContactIds),
      groupName,
      parentGroupId: groupId
    }, {
      method: 'post',
      action: '/api/editor/actions',
      navigate: false
    })
    
    onClose()
  }
  
  const handleInlineGroup = () => {
    if (selectedGroupIds.length !== 1) return
    
    const groupNode = nodes.find(n => n.id === selectedGroupIds[0])
    if (!groupNode?.data.isGadget) { // Only inline non-gadget groups
      submit({
        intent: 'inline-group',
        groupId: selectedGroupIds[0]
      }, {
        method: 'post',
        action: '/api/editor/actions',
        navigate: false
      })
    }
    
    onClose()
  }
  
  const handleCopySelection = () => {
    if (selectedContactIds.length === 0 && selectedGroupIds.length === 0) return
    
    // Use unified copy-selection
    submit({
      intent: 'copy-selection',
      contactIds: JSON.stringify(selectedContactIds),
      groupIds: JSON.stringify(selectedGroupIds),
      targetGroupId: groupId,
      includeWires: 'true',
      deep: 'true'
    }, {
      method: 'post',
      action: '/api/editor/actions',
      navigate: false
    })
    
    onClose()
  }
  
  const handleDelete = () => {
    // Delete selected nodes
    selectedNodes.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        if (node.type === 'contact' || node.type === 'slider') {
          submit({
            intent: 'delete-contact',
            contactId: nodeId
          }, {
            method: 'post',
            action: '/api/editor/actions',
            navigate: false
          })
        } else if (node.type === 'group') {
          submit({
            intent: 'delete-group',
            groupId: nodeId
          }, {
            method: 'post',
            action: '/api/editor/actions',
            navigate: false
          })
        }
      }
    })
    
    onClose()
  }
  
  // Determine available actions
  const canExtract = selectedContactIds.length > 0
  const canInline = selectedGroupIds.length === 1 && 
    nodes.find(n => n.id === selectedGroupIds[0])?.data.isGadget === false
  const canCopy = selectedNodes.length > 0
  const canDelete = selectedNodes.length > 0
  
  return (
    <div
      ref={menuRef}
      className="absolute bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {canExtract && (
        <button
          onClick={handleExtractToGroup}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
        >
          🗂️ Extract to Group
        </button>
      )}
      
      {canInline && (
        <button
          onClick={handleInlineGroup}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
        >
          📤 Inline Group
        </button>
      )}
      
      {(canExtract || canInline) && canCopy && (
        <div className="border-t border-gray-200 my-1" />
      )}
      
      {canCopy && (
        <button
          onClick={handleCopySelection}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
        >
          📋 Copy Selection
        </button>
      )}
      
      {(canExtract || canInline || canCopy) && canDelete && (
        <div className="border-t border-gray-200 my-1" />
      )}
      
      {canDelete && (
        <button
          onClick={handleDelete}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-600"
        >
          🗑️ Delete
        </button>
      )}
      
      {!canExtract && !canInline && !canDelete && (
        <div className="px-4 py-2 text-sm text-gray-400">
          No actions available
        </div>
      )}
    </div>
  )
}