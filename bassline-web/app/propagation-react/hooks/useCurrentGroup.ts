import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import type { ContactGroup, Contact, Wire, Position } from '~/propagation-core'
import { useSound } from '~/components/SoundSystem'

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
  const { network, syncToReactFlow, currentGroupId, setCurrentGroupId, appSettings } = useNetworkContext()
  const [currentGroup, setCurrentGroup] = useState(network.currentGroup)
  const { play: playCreateSound } = useSound('node/create')
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
    network.navigateToGroup(groupId)
    setCurrentGroupId(groupId)
    
    // Play navigation sound based on direction
    const newGroup = network.currentGroup
    const previousGroup = network.findGroup(previousGroupId)
    if (previousGroup && newGroup.parent === previousGroup) {
      playEnterGadgetSound() // Going deeper
    } else {
      playExitGadgetSound() // Going up or sideways
    }
  }, [network, setCurrentGroupId, playEnterGadgetSound, playExitGadgetSound])
  
  const navigateToParent = useCallback(() => {
    network.navigateToParent()
    setCurrentGroupId(network.currentGroup.id)
    playExitGadgetSound() // Always going up when navigating to parent
  }, [network, setCurrentGroupId, playExitGadgetSound])
  
  const navigateToRoot = useCallback(() => {
    network.currentGroup = network.rootGroup
    setCurrentGroupId(network.rootGroup.id)
    syncToReactFlow()
  }, [network, setCurrentGroupId, syncToReactFlow])
  
  // Operations
  const addContact = useCallback((position: Position): Contact => {
    const contact = network.addContact(position, appSettings.propagation.defaultBlendMode)
    syncToReactFlow()
    playCreateSound()
    return contact
  }, [network, syncToReactFlow, appSettings.propagation.defaultBlendMode, playCreateSound])
  
  const addBoundaryContact = useCallback((position: Position, direction: 'input' | 'output', name?: string): Contact => {
    const blendMode = appSettings.propagation.defaultBoundaryBlendMode || appSettings.propagation.defaultBlendMode
    const contact = network.addBoundaryContact(position, direction, name, blendMode)
    syncToReactFlow()
    playCreateSound()
    return contact
  }, [network, syncToReactFlow, appSettings.propagation.defaultBlendMode, appSettings.propagation.defaultBoundaryBlendMode, playCreateSound])
  
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