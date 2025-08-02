import { useState, useCallback } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import type { ContactId } from '~/propagation-core'

interface PropagationEvent {
  timestamp: number
  fromContactId: ContactId
  toContactId: ContactId
  content: any
}

interface UsePropagationReturn {
  isPropagating: boolean
  propagationPath: ContactId[]
  
  // Manual control
  triggerPropagation: (contactId: string) => void
  pausePropagation: () => void
  resumePropagation: () => void
  
  // Debugging
  propagationHistory: PropagationEvent[]
  clearHistory: () => void
}

/**
 * Hook for monitoring and controlling propagation.
 * Currently provides a basic implementation - will be enhanced
 * when we add propagation visualization features.
 */
export function usePropagation(): UsePropagationReturn {
  const { network, syncToReactFlow } = useNetworkContext()
  const [isPropagating, setIsPropagating] = useState(false)
  const [propagationPath, setPropagationPath] = useState<ContactId[]>([])
  const [propagationHistory, setPropagationHistory] = useState<PropagationEvent[]>([])
  const [isPaused, setIsPaused] = useState(false)
  
  // Trigger manual propagation from a contact
  const triggerPropagation = useCallback((contactId: string) => {
    if (isPaused) return
    
    const contact = network.findContact(contactId)
    if (!contact) return
    
    // Start propagation tracking
    setIsPropagating(true)
    setPropagationPath([contactId])
    
    // Trigger the propagation
    contact['propagate']()
    
    // Mark propagation complete
    setIsPropagating(false)
    setPropagationPath([])
    
    // Sync the UI
    syncToReactFlow()
  }, [network, isPaused, syncToReactFlow])
  
  // Pause propagation (for future use when we have async propagation)
  const pausePropagation = useCallback(() => {
    setIsPaused(true)
  }, [])
  
  // Resume propagation
  const resumePropagation = useCallback(() => {
    setIsPaused(false)
  }, [])
  
  // Clear propagation history
  const clearHistory = useCallback(() => {
    setPropagationHistory([])
  }, [])
  
  // TODO: In the future, we'll subscribe to propagation events from the network
  // and update the propagationPath and history in real-time
  
  return {
    isPropagating,
    propagationPath,
    
    // Manual control
    triggerPropagation,
    pausePropagation,
    resumePropagation,
    
    // Debugging
    propagationHistory,
    clearHistory
  }
}