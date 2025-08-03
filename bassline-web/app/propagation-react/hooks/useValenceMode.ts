import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import { useContextSelection } from './useContextSelection'
import { usePropertyPanel } from './usePropertyPanel'
import { ValenceConnectOperation } from '~/propagation-core/refactoring/operations/ValenceConnect'
import type { ContactGroup, Contact } from '~/propagation-core'
import { useSound } from '~/components/SoundSystem'
import { toast } from 'sonner'

export interface ValenceSource {
  contacts: Contact[]
  gadgets: ContactGroup[]
  totalOutputCount: number
  sourceIds: Set<string> // All source contact and gadget IDs for visual filtering
}

export interface UseValenceModeReturn {
  // Mode state
  isValenceMode: boolean
  enterValenceMode: () => void
  exitValenceMode: () => void
  
  // Source info (what was selected when entering mode)
  valenceSource: ValenceSource | null
  
  // Check if a gadget can be connected to
  canConnectToGadget: (gadgetId: string) => boolean
  
  // Perform connection to a gadget
  connectToGadget: (gadgetId: string) => boolean
  
  // Get all compatible gadgets
  getCompatibleGadgets: () => ContactGroup[]
}

export function useValenceMode(): UseValenceModeReturn {
  const { network, syncToReactFlow, highlightedNodeId } = useNetworkContext()
  const { selectedContacts, selectedGroups, clearSelection } = useContextSelection()
  const { play: playConnectionSound } = useSound('connection/create')
  const propertyPanel = usePropertyPanel()
  
  const [isValenceMode, setIsValenceMode] = useState(false)
  const [valenceSource, setValenceSource] = useState<ValenceSource | null>(null)
  
  // Enter valence mode with current selection
  const enterValenceMode = useCallback(() => {
    if (selectedContacts.length === 0 && selectedGroups.length === 0) {
      toast.error('Select contacts and/or gadgets first')
      return
    }
    
    // Calculate total outputs from selection
    let totalOutputCount = selectedContacts.length
    for (const gadget of selectedGroups) {
      const { outputs } = gadget.getBoundaryContacts()
      totalOutputCount += outputs.length
    }
    
    if (totalOutputCount === 0) {
      toast.error('Selected items have no outputs')
      return
    }
    
    // Collect all source IDs for visual filtering
    const sourceIds = new Set<string>()
    selectedContacts.forEach(c => sourceIds.add(c.id))
    selectedGroups.forEach(g => sourceIds.add(g.id))
    
    setValenceSource({
      contacts: [...selectedContacts],
      gadgets: [...selectedGroups],
      totalOutputCount,
      sourceIds
    })
    
    setIsValenceMode(true)
    clearSelection() // Clear selection so user can click on targets
    
    toast.success(`Valence mode: Click gadgets with ${totalOutputCount} inputs to connect`)
  }, [selectedContacts, selectedGroups, clearSelection])
  
  // Exit valence mode
  const exitValenceMode = useCallback(() => {
    setIsValenceMode(false)
    setValenceSource(null)
    
    // If property panel is open and has a focused item, stay in focus mode
    if (propertyPanel.isVisible && highlightedNodeId) {
      toast.info('Back to property focus mode')
    } else {
      toast.info('Exited valence mode')
    }
  }, [propertyPanel.isVisible, highlightedNodeId])
  
  // Check if a gadget can be connected to
  const canConnectToGadget = useCallback((gadgetId: string): boolean => {
    if (!valenceSource || !isValenceMode) return false
    
    const targetGadget = network.currentGroup.subgroups.get(gadgetId)
    if (!targetGadget) return false
    
    // Don't connect to source gadgets
    if (valenceSource.gadgets.some(g => g.id === gadgetId)) return false
    
    const { inputs } = targetGadget.getBoundaryContacts()
    return inputs.length === valenceSource.totalOutputCount
  }, [valenceSource, isValenceMode, network])
  
  // Connect to a specific gadget
  const connectToGadget = useCallback((gadgetId: string): boolean => {
    if (!valenceSource || !isValenceMode) return false
    
    const targetGadget = network.currentGroup.subgroups.get(gadgetId)
    if (!targetGadget || !canConnectToGadget(gadgetId)) return false
    
    const operation = new ValenceConnectOperation()
    const sourceGadgetIds = valenceSource.gadgets.map(g => g.id)
    const contactIds = valenceSource.contacts.map(c => c.id)
    
    const result = operation.executeMixedToGadget(
      network.currentGroup,
      sourceGadgetIds,
      contactIds,
      gadgetId
    )
    
    if (result.success) {
      syncToReactFlow()
      
      // Play connection sounds
      if (result.connectionCount) {
        for (let i = 0; i < result.connectionCount; i++) {
          setTimeout(() => playConnectionSound(), i * 50)
        }
      }
      
      toast.success(`Connected ${result.connectionCount} wires to ${targetGadget.name}`)
    } else {
      toast.error(result.message || 'Failed to connect')
    }
    
    return result.success
  }, [valenceSource, isValenceMode, network, canConnectToGadget, syncToReactFlow, playConnectionSound])
  
  // Get all compatible gadgets
  const getCompatibleGadgets = useCallback((): ContactGroup[] => {
    if (!valenceSource || !isValenceMode) return []
    
    const compatible: ContactGroup[] = []
    for (const [gadgetId, gadget] of network.currentGroup.subgroups) {
      if (canConnectToGadget(gadgetId)) {
        compatible.push(gadget)
      }
    }
    
    return compatible
  }, [valenceSource, isValenceMode, network, canConnectToGadget])
  
  // Escape handling moved to editor for stack-based flow
  
  return {
    isValenceMode,
    enterValenceMode,
    exitValenceMode,
    valenceSource,
    canConnectToGadget,
    connectToGadget,
    getCompatibleGadgets
  }
}