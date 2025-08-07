import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useNetworkState } from '~/propagation-react/contexts/NetworkState'

export function URLStateSync() {
  const navigate = useNavigate()
  const { state } = useNetworkState()
  const { currentGroupId, rootGroupId } = state
  
  // Update URL when currentGroupId changes
  useEffect(() => {
    if (currentGroupId !== rootGroupId) {
      navigate(`?group=${currentGroupId}`, { replace: true })
    } else {
      // Clear group param when at root
      navigate('', { replace: true })
    }
  }, [currentGroupId, rootGroupId, navigate])
  
  return null
}