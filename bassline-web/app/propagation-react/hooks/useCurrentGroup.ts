import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import type { ContactGroup, Contact, Wire, Position } from '~/propagation-core'
import { useSound } from '~/components/SoundSystem'
import { useNavigationState } from './useURLState'

interface Breadcrumb {
  id: string
  name: string
}

interface UseCurrentGroupReturn {
  currentGroup: ContactGroup
  breadcrumbs: Breadcrumb[]
  
  // All contacts/wires in view
  visibleContacts: Contact[]
  visibleWires: Wire[]
  visibleSubgroups: ContactGroup[]
  
  // Navigation
  navigateToGroup: (groupId: string) => void
  navigateToParent: () => void
  navigateToRoot: () => void
  
  // Operations on current group
  addContact: (position: Position) => Contact
  addBoundaryContact: (position: Position, direction: 'input' | 'output', name?: string) => Contact
  createSubgroup: (name: string, position?: Position) => ContactGroup
  connect: (fromId: string, toId: string, type?: 'bidirectional' | 'directed') => Wire
}

export function useCurrentGroup(): UseCurrentGroupReturn {
  const { network, syncToReactFlow, currentGroupId, appSettings } = useNetworkContext()
  const { navigateToGroup: urlNavigateToGroup, navigateToParent: urlNavigateToParent } = useNavigationState()
  const [currentGroup, setCurrentGroup] = useState(network.currentGroup)
  const { play: playPlaceSound } = useSound('ui/place')
  const { play: playCreateGadgetSound } = useSound('gadget/create')
  const { play: playConnectSound } = useSound('connection/create')
  const { play: playEnterGadgetSound } = useSound('gadget/enter')
  const { play: playExitGadgetSound } = useSound('gadget/exit')
  
  // Update current group when ID changes
  useEffect(() => {
    const group = network.findGroup(currentGroupId) || network.rootGroup
    setCurrentGroup(group)
    network.currentGroup = group
  }, [currentGroupId, network])
  
  // Get visible entities
  const visibleContacts = useMemo(() => {
    const view = network.getCurrentView()
    return view.contacts
  }, [network, currentGroupId]) // Re-compute when group changes
  
  const visibleWires = useMemo(() => {
    const view = network.getCurrentView()
    return view.wires
  }, [network, currentGroupId])
  
  const visibleSubgroups = useMemo(() => {
    const view = network.getCurrentView()
    return view.subgroups
  }, [network, currentGroupId])
  
  // Navigation
  const navigateToGroup = useCallback((groupId: string) => {
    const previousGroupId = network.currentGroup.id
    
    // Build navigation path
    const targetGroup = network.findGroup(groupId)
    if (!targetGroup) return
    
    const path: string[] = []
    let current: ContactGroup | null = targetGroup as ContactGroup | null
    while (current && current !== network.rootGroup) {
      path.unshift(current.id)
      current = current.parent ?? null
    }
    
    // Use URL navigation
    urlNavigateToGroup(groupId, path.join('/'))
    
    // Play navigation sound based on direction
    const previousGroup = network.findGroup(previousGroupId)
    if (previousGroup && targetGroup.parent === previousGroup) {
      playEnterGadgetSound() // Going deeper
    } else {
      playExitGadgetSound() // Going up or sideways
    }
  }, [network, urlNavigateToGroup, playEnterGadgetSound, playExitGadgetSound])
  
  const navigateToParent = useCallback(() => {
    urlNavigateToParent()
    playExitGadgetSound() // Always going up when navigating to parent
  }, [urlNavigateToParent, playExitGadgetSound])
  
  const navigateToRoot = useCallback(() => {
    // Clear navigation params to go to root
    urlNavigateToGroup('', '')
    syncToReactFlow()
  }, [urlNavigateToGroup, syncToReactFlow])
  
  // Operations
  const addContact = useCallback((position: Position): Contact => {
    const contact = network.addContact(position, appSettings.propagation.defaultBlendMode)
    syncToReactFlow()
    playPlaceSound()
    return contact
  }, [network, syncToReactFlow, appSettings.propagation.defaultBlendMode, playPlaceSound])
  
  const addBoundaryContact = useCallback((position: Position, direction: 'input' | 'output', name?: string): Contact => {
    const blendMode = appSettings.propagation.defaultBoundaryBlendMode || appSettings.propagation.defaultBlendMode
    const contact = network.addBoundaryContact(position, direction, name, blendMode)
    syncToReactFlow()
    playPlaceSound()
    return contact
  }, [network, syncToReactFlow, appSettings.propagation.defaultBlendMode, appSettings.propagation.defaultBoundaryBlendMode, playPlaceSound])
  
  const createSubgroup = useCallback((name: string, position?: Position): ContactGroup => {
    const group = network.createGroup(name)
    if (position) {
      group.position = position
    }
    syncToReactFlow()
    playCreateGadgetSound()
    return group
  }, [network, syncToReactFlow, playCreateGadgetSound])
  
  const connect = useCallback((fromId: string, toId: string, type?: 'bidirectional' | 'directed'): Wire => {
    const wire = network.connect(fromId, toId, type)
    syncToReactFlow()
    playConnectSound()
    return wire
  }, [network, syncToReactFlow, playConnectSound])
  
  return {
    currentGroup,
    breadcrumbs: network.getBreadcrumbs(),
    
    // Visible entities
    visibleContacts,
    visibleWires,
    visibleSubgroups,
    
    // Navigation
    navigateToGroup,
    navigateToParent,
    navigateToRoot,
    
    // Operations
    addContact,
    addBoundaryContact,
    createSubgroup,
    connect
  }
}