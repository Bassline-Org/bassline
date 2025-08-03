import { useCallback, useMemo } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import { useContextSelection } from './useContextSelection'
import { ValenceConnectOperation, type ValenceConnectionResult } from '~/propagation-core/refactoring/operations/ValenceConnect'
import type { ContactGroup } from '~/propagation-core'
import { useSound } from '~/components/SoundSystem'
import { toast } from 'sonner'

export interface UseValenceConnectReturn {
  // Check if selected items can be valence-connected
  canValenceConnect: boolean
  valenceConnectionType: 'gadget-to-gadget' | 'contacts-to-gadget' | 'gadget-to-contacts' | 'mixed-to-gadget' | null
  selectedGadgetsInfo: { count: number; gadgets: ContactGroup[] }
  totalSourceCount?: number // For mixed selections
  
  // Perform valence connection
  valenceConnect: () => boolean
  
  // Find compatible gadgets for a specific gadget
  findCompatibleGadgets: (gadgetId: string) => ContactGroup[]
  
  // Check if two specific gadgets are compatible
  areGadgetsCompatible: (gadget1Id: string, gadget2Id: string) => boolean
  
  // Check if mixed selection is compatible with a specific gadget
  isMixedSelectionCompatibleWithGadget: (gadgetId: string) => boolean
}

export function useValenceConnect(): UseValenceConnectReturn {
  const { network, syncToReactFlow } = useNetworkContext()
  const { selectedGroups, selectedContacts, clearSelection } = useContextSelection()
  const { play: playConnectionSound } = useSound('connection/create')
  
  // Determine what type of valence connection is possible
  const { canValenceConnect, valenceConnectionType, totalSourceCount } = useMemo(() => {
    // Case 1: Two gadgets selected (no contacts)
    if (selectedGroups.length === 2 && selectedContacts.length === 0) {
      const [gadget1, gadget2] = selectedGroups
      if (ValenceConnectOperation.areValenceCompatible(gadget1, gadget2)) {
        return { canValenceConnect: true, valenceConnectionType: 'gadget-to-gadget' as const, totalSourceCount: 0 }
      }
    }
    
    // Case 2: Exactly one gadget and some contacts
    if (selectedGroups.length === 1 && selectedContacts.length > 0) {
      const gadget = selectedGroups[0]
      
      // Check if contacts can connect to gadget inputs
      if (ValenceConnectOperation.canConnectContactsToGadget(selectedContacts, gadget)) {
        return { canValenceConnect: true, valenceConnectionType: 'contacts-to-gadget' as const, totalSourceCount: 0 }
      }
      
      // Check if gadget outputs can connect to contacts
      if (ValenceConnectOperation.canConnectGadgetToContacts(gadget, selectedContacts)) {
        return { canValenceConnect: true, valenceConnectionType: 'gadget-to-contacts' as const, totalSourceCount: 0 }
      }
    }
    
    // Case 3: Mixed selection with 2 gadgets where one might be the target
    if (selectedGroups.length === 2 && selectedContacts.length > 0) {
      // Try each gadget as the target
      for (let i = 0; i < 2; i++) {
        const sourceGadgets = [selectedGroups[1-i]] // The other gadget
        const targetGadget = selectedGroups[i]
        
        if (ValenceConnectOperation.canConnectMixedToGadget(sourceGadgets, selectedContacts, targetGadget)) {
          return { 
            canValenceConnect: true, 
            valenceConnectionType: 'mixed-to-gadget' as const,
            totalSourceCount: sourceGadgets[0].getBoundaryContacts().outputs.length + selectedContacts.length
          }
        }
      }
    }
    
    return { canValenceConnect: false, valenceConnectionType: null, totalSourceCount: 0 }
  }, [selectedGroups, selectedContacts, network])
  
  // Perform valence connection based on selection type
  const valenceConnect = useCallback((): boolean => {
    if (!canValenceConnect || !valenceConnectionType) return false
    
    const operation = new ValenceConnectOperation()
    let result: ValenceConnectionResult
    
    switch (valenceConnectionType) {
      case 'gadget-to-gadget': {
        if (selectedGroups.length !== 2) return false
        const [gadget1, gadget2] = selectedGroups
        result = operation.execute(network.currentGroup, gadget1.id, gadget2.id)
        break
      }
      
      case 'contacts-to-gadget': {
        if (selectedGroups.length !== 1 || selectedContacts.length === 0) return false
        const gadget = selectedGroups[0]
        const contactIds = selectedContacts.map(c => c.id)
        result = operation.executeContactsToGadget(network.currentGroup, contactIds, gadget.id)
        break
      }
      
      case 'gadget-to-contacts': {
        if (selectedGroups.length !== 1 || selectedContacts.length === 0) return false
        const gadget = selectedGroups[0]
        const contactIds = selectedContacts.map(c => c.id)
        result = operation.executeGadgetToContacts(network.currentGroup, gadget.id, contactIds)
        break
      }
      
      case 'mixed-to-gadget': {
        if (selectedGroups.length !== 2 || selectedContacts.length === 0) return false
        
        // Figure out which gadget is the target
        let sourceGadgets: ContactGroup[] = []
        let targetGadget: ContactGroup | null = null
        
        for (let i = 0; i < 2; i++) {
          const possibleSources = [selectedGroups[1-i]]
          const possibleTarget = selectedGroups[i]
          
          if (ValenceConnectOperation.canConnectMixedToGadget(possibleSources, selectedContacts, possibleTarget)) {
            sourceGadgets = possibleSources
            targetGadget = possibleTarget
            break
          }
        }
        
        if (!targetGadget) return false
        
        const sourceGadgetIds = sourceGadgets.map(g => g.id)
        const contactIds = selectedContacts.map(c => c.id)
        result = operation.executeMixedToGadget(network.currentGroup, sourceGadgetIds, contactIds, targetGadget.id)
        break
      }
      
      default:
        return false
    }
    
    if (result.success) {
      clearSelection()
      syncToReactFlow()
      
      // Play connection sound for each wire created
      if (result.connectionCount) {
        for (let i = 0; i < result.connectionCount; i++) {
          setTimeout(() => playConnectionSound(), i * 50) // Stagger sounds slightly
        }
      }
      
      toast.success(result.message || 'Connected')
    } else {
      toast.error(result.message || 'Failed to connect')
    }
    
    return result.success
  }, [canValenceConnect, valenceConnectionType, selectedGroups, selectedContacts, network, clearSelection, syncToReactFlow, playConnectionSound])
  
  // Find all gadgets compatible with a specific gadget
  const findCompatibleGadgets = useCallback((gadgetId: string): ContactGroup[] => {
    return ValenceConnectOperation.findCompatibleGadgets(network.currentGroup, gadgetId)
  }, [network])
  
  // Check if two specific gadgets are compatible
  const areGadgetsCompatible = useCallback((gadget1Id: string, gadget2Id: string): boolean => {
    const gadget1 = network.currentGroup.subgroups.get(gadget1Id)
    const gadget2 = network.currentGroup.subgroups.get(gadget2Id)
    
    if (!gadget1 || !gadget2) return false
    return ValenceConnectOperation.areValenceCompatible(gadget1, gadget2)
  }, [network])
  
  // Check if current mixed selection is compatible with a specific gadget
  const isMixedSelectionCompatibleWithGadget = useCallback((gadgetId: string): boolean => {
    const gadget = network.currentGroup.subgroups.get(gadgetId)
    if (!gadget) return false
    
    // Don't include this gadget if it's already selected
    const otherSelectedGadgets = selectedGroups.filter(g => g.id !== gadgetId)
    
    return ValenceConnectOperation.canConnectMixedToGadget(
      otherSelectedGadgets,
      selectedContacts,
      gadget
    )
  }, [selectedGroups, selectedContacts, network])
  
  return {
    canValenceConnect,
    valenceConnectionType,
    selectedGadgetsInfo: { count: selectedGroups.length, gadgets: selectedGroups },
    totalSourceCount,
    valenceConnect,
    findCompatibleGadgets,
    areGadgetsCompatible,
    isMixedSelectionCompatibleWithGadget
  }
}