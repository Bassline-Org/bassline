import { useCallback, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { getNetworkClient } from '~/network/client'

interface BreadcrumbItem {
  id: string
  name: string
}

interface BreadcrumbsProps {
  currentGroupId: string
}

export function Breadcrumbs({ currentGroupId }: BreadcrumbsProps) {
  const navigate = useNavigate()
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  
  // Build breadcrumb trail
  useEffect(() => {
    const buildBreadcrumbs = async () => {
      const client = getNetworkClient()
      const items: BreadcrumbItem[] = []
      let groupId = currentGroupId
      
      // Build trail from current to root
      while (groupId) {
        try {
          const state = await client.getState(groupId)
          items.unshift({
            id: groupId,
            name: state.group.name || (groupId === 'root' ? 'Root' : `Group ${groupId.slice(0, 8)}`)
          })
          
          // Move to parent
          groupId = state.group.parentId || ''
          if (groupId === 'root' || !groupId) {
            if (currentGroupId !== 'root') {
              items.unshift({ id: 'root', name: 'Root' })
            }
            break
          }
        } catch (error) {
          console.warn(`Failed to build breadcrumb for ${groupId}:`, error)
          break
        }
      }
      
      setBreadcrumbs(items)
    }
    
    buildBreadcrumbs()
  }, [currentGroupId])
  
  const handleClick = useCallback((groupId: string) => {
    if (groupId === 'root') {
      navigate('/editor-v2')
    } else {
      navigate(`/editor-v2/${groupId}`)
    }
  }, [navigate])
  
  return (
    <div className="flex items-center gap-2 text-sm">
      {breadcrumbs.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          {index > 0 && <span className="text-gray-400">/</span>}
          <button
            onClick={() => handleClick(item.id)}
            className={`
              px-2 py-1 rounded hover:bg-gray-100
              ${item.id === currentGroupId ? 'font-semibold text-blue-600' : 'text-gray-600'}
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