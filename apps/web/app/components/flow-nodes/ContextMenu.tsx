import { useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { Trash2, Group, Ungroup, Copy, Edit } from 'lucide-react'

interface ContextMenuProps {
  x: number
  y: number
  selectedNodes: string[]
  selectedEdges: string[]
  nodes: any[]
  onClose: () => void
}

export function ContextMenu({ 
  x, 
  y, 
  selectedNodes, 
  selectedEdges, 
  nodes, 
  onClose 
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const fetcher = useFetcher()
  
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
    return node?.type === 'contact'
  })
  
  // Get selected group nodes
  const selectedGroupIds = selectedNodes.filter(nodeId => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.type === 'group'
  })
  
  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0
  const hasContacts = selectedContactIds.length > 0
  const hasGroups = selectedGroupIds.length > 0
  const hasOnlyOneGroup = selectedGroupIds.length === 1 && selectedContactIds.length === 0
  
  const handleDelete = () => {
    // Delete selected nodes
    selectedNodes.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        fetcher.submit(
          { intent: 'delete-node', nodeId, nodeType: node.type },
          { method: 'post' }
        )
      }
    })
    
    // Delete selected edges
    selectedEdges.forEach(edgeId => {
      fetcher.submit(
        { intent: 'delete-edge', edgeId },
        { method: 'post' }
      )
    })
    
    onClose()
  }
  
  const handleGroup = () => {
    if (selectedContactIds.length > 0) {
      fetcher.submit(
        { 
          intent: 'extract-to-group',
          contactIds: JSON.stringify(selectedContactIds),
          groupName: `Group ${Date.now().toString(36)}`
        },
        { method: 'post' }
      )
    }
    onClose()
  }
  
  const handleUngroup = () => {
    if (selectedGroupIds.length === 1) {
      fetcher.submit(
        { 
          intent: 'inline-group',
          groupId: selectedGroupIds[0]
        },
        { method: 'post' }
      )
    }
    onClose()
  }
  
  const handleDuplicate = () => {
    // TODO: Implement duplication
    console.log('Duplicate:', selectedNodes)
    onClose()
  }
  
  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {hasSelection && (
        <>
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          
          {hasContacts && (
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={handleGroup}
            >
              <Group className="w-4 h-4" />
              Group
            </button>
          )}
          
          {hasOnlyOneGroup && (
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={handleUngroup}
            >
              <Ungroup className="w-4 h-4" />
              Ungroup
            </button>
          )}
          
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={handleDuplicate}
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </button>
        </>
      )}
      
      {!hasSelection && (
        <div className="px-3 py-2 text-sm text-gray-500">
          No selection
        </div>
      )}
    </div>
  )
}