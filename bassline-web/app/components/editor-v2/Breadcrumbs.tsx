import { useCallback } from 'react'
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
  
  // For now, just show current group
  // TODO: Build full breadcrumb trail by traversing parent groups
  const breadcrumbs: BreadcrumbItem[] = [
    { id: 'root', name: 'Root' },
    ...(currentGroupId !== 'root' ? [{ id: currentGroupId, name: `Group ${currentGroupId}` }] : [])
  ]
  
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