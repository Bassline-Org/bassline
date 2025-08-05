import { useCallback } from 'react'
import { useModeContext } from '../contexts/ModeContext'
import { useNetworkState } from '../contexts/NetworkState'
import { useSoundSystem } from '~/components/SoundSystem'
import { useSoundToast } from '~/hooks/useSoundToast'

export function useValenceMode() {
  const { currentMode, valenceSourceIds, exitMode } = useModeContext()
  const { addWire, state } = useNetworkState()
  const { currentGroupId } = state
  const { playSound } = useSoundSystem()
  const toast = useSoundToast()
  
  const handleContactClick = useCallback((targetId: string) => {
    if (currentMode !== 'valence' || valenceSourceIds.length === 0) {
      return false // Not handled
    }
    
    // Create wires from all sources to the target
    let connectionsCreated = 0
    
    valenceSourceIds.forEach(sourceId => {
      // Don't connect to self
      if (sourceId === targetId) return
      
      // Check if wire already exists
      const wireExists = Object.values(state.wires).some(
        wire => (wire.fromId === sourceId && wire.toId === targetId) ||
                (wire.fromId === targetId && wire.toId === sourceId)
      )
      
      if (!wireExists) {
        addWire(currentGroupId, {
          fromId: sourceId,
          toId: targetId,
          type: 'bidirectional'
        })
        connectionsCreated++
      }
    })
    
    if (connectionsCreated > 0) {
      playSound('connection/create')
      toast.success(`Created ${connectionsCreated} connection${connectionsCreated > 1 ? 's' : ''}`)
    } else {
      toast.info('Wire already exists')
    }
    
    // Exit valence mode after connecting
    exitMode()
    
    return true // Handled
  }, [currentMode, valenceSourceIds, addWire, currentGroupId, state.wires, playSound, toast, exitMode])
  
  return {
    handleContactClick,
    isValenceMode: currentMode === 'valence',
    isValenceSource: (id: string) => valenceSourceIds.includes(id),
    isValenceTarget: (id: string) => currentMode === 'valence' && !valenceSourceIds.includes(id)
  }
}