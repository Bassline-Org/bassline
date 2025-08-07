import { useCallback } from 'react'
import { useNetworkState } from '../contexts/NetworkState'

export function useGroupState(groupId: string | null) {
  const { state, updateGroup } = useNetworkState()
  
  const group = groupId ? state.groups[groupId] : null
  
  const setName = useCallback((name: string) => {
    if (!groupId) return
    updateGroup(groupId, { name })
  }, [groupId, updateGroup])
  
  const setIsPrimitive = useCallback((isPrimitive: boolean) => {
    if (!groupId) return
    updateGroup(groupId, { isPrimitive })
  }, [groupId, updateGroup])
  
  return {
    name: group?.name || '',
    isPrimitive: group?.isPrimitive || false,
    contactIds: group?.contactIds || [],
    subgroupIds: group?.subgroupIds || [],
    boundaryContactIds: group?.boundaryContactIds || [],
    setName,
    setIsPrimitive
  }
}