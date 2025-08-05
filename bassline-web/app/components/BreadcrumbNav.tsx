import { useCallback } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { useNetworkState } from '~/propagation-react/contexts/NetworkState'
import { useSoundSystem } from './SoundSystem'

export function BreadcrumbNav() {
  const { state, setCurrentGroup } = useNetworkState()
  const { playSound } = useSoundSystem()
  const { currentGroupId, groups } = state
  
  // Build breadcrumb path
  const breadcrumbs = []
  let groupId = currentGroupId
  
  while (groupId) {
    const group = groups[groupId]
    if (!group) break
    
    breadcrumbs.unshift({ id: groupId, name: group.name })
    groupId = group.parentId || null
  }
  
  const handleNavigate = useCallback((groupId: string) => {
    setCurrentGroup(groupId)
    playSound('gadget/exit')
  }, [setCurrentGroup, playSound])
  
  if (breadcrumbs.length === 0) return null
  
  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-background/95 backdrop-blur px-3 py-1.5 rounded-md shadow-sm border">
      <Home className="w-4 h-4 text-muted-foreground" />
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.id} className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <button
            onClick={() => handleNavigate(crumb.id)}
            className={`
              text-sm px-2 py-0.5 rounded hover:bg-accent hover:text-accent-foreground
              ${index === breadcrumbs.length - 1 ? 'font-semibold' : ''}
            `}
          >
            {crumb.name}
          </button>
        </div>
      ))}
    </div>
  )
}