import { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'

interface BreadcrumbItem {
  id: string
  name: string
}

interface FlowBreadcrumbsProps {
  currentGroupId: string
  sessionId: string
  client: any  // UIAdapter with getState method
}

export function FlowBreadcrumbs({ currentGroupId, sessionId, client }: FlowBreadcrumbsProps) {
  const navigate = useNavigate()
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  
  // Build breadcrumb trail
  useEffect(() => {
    const buildBreadcrumbs = async () => {
      const items: BreadcrumbItem[] = []
      let groupId = currentGroupId
      const visited = new Set<string>() // Prevent infinite loops
      
      // Build trail from current to root
      while (groupId && !visited.has(groupId)) {
        visited.add(groupId)
        
        try {
          const state = await client.getState?.(groupId)
          if (!state) {
            console.warn(`No state returned for group ${groupId}`)
            break
          }
          items.unshift({
            id: groupId,
            name: state.group.name || (groupId === 'root' ? 'Root' : `Group ${groupId.slice(0, 8)}`)
          })
          
          // Move to parent
          const parentId = state.group.parentId
          if (!parentId || parentId === groupId || parentId === 'root') {
            // Ensure root is always at the beginning if we're not at root
            if (currentGroupId !== 'root' && !items.some(item => item.id === 'root')) {
              items.unshift({ id: 'root', name: 'Root' })
            }
            break
          }
          groupId = parentId
        } catch (error) {
          console.warn(`Failed to build breadcrumb for ${groupId}:`, error)
          break
        }
      }
      
      setBreadcrumbs(items)
    }
    
    if (client) {
      buildBreadcrumbs()
    }
  }, [currentGroupId, client])
  
  const handleClick = useCallback((groupId: string) => {
    navigate(`/flow/session/${sessionId}/group/${groupId}`)
  }, [navigate, sessionId])
  
  if (breadcrumbs.length <= 1) {
    return null // Don't show breadcrumbs if there's only one level
  }
  
  return (
    <div className="flex items-center gap-2 text-sm bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm">
      {breadcrumbs.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          {index > 0 && <span className="text-gray-400">/</span>}
          <button
            onClick={() => handleClick(item.id)}
            className={`
              px-2 py-1 rounded transition-colors
              ${item.id === currentGroupId 
                ? 'font-semibold text-blue-600 cursor-default' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
            `}
            disabled={item.id === currentGroupId}
          >
            {item.name}
          </button>
        </div>
      ))}
    </div>
  )
}