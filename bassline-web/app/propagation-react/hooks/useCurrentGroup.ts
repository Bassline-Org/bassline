import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import type { ContactGroup, Contact, Wire, Position } from '~/propagation-core'

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
  const { network, syncToReactFlow, currentGroupId, setCurrentGroupId } = useNetworkContext()
  const [currentGroup, setCurrentGroup] = useState(network.currentGroup)
  
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
    network.navigateToGroup(groupId)
    setCurrentGroupId(groupId)
  }, [network, setCurrentGroupId])
  
  const navigateToParent = useCallback(() => {
    network.navigateToParent()
    setCurrentGroupId(network.currentGroup.id)
  }, [network, setCurrentGroupId])
  
  const navigateToRoot = useCallback(() => {
    network.currentGroup = network.rootGroup
    setCurrentGroupId(network.rootGroup.id)
    syncToReactFlow()
  }, [network, setCurrentGroupId, syncToReactFlow])
  
  // Operations
  const addContact = useCallback((position: Position): Contact => {
    const contact = network.addContact(position)
    syncToReactFlow()
    return contact
  }, [network, syncToReactFlow])
  
  const addBoundaryContact = useCallback((position: Position, direction: 'input' | 'output', name?: string): Contact => {
    const contact = network.addBoundaryContact(position, direction, name)
    syncToReactFlow()
    return contact
  }, [network, syncToReactFlow])
  
  const createSubgroup = useCallback((name: string, position?: Position): ContactGroup => {
    const group = network.createGroup(name)
    if (position) {
      group.position = position
    }
    syncToReactFlow()
    return group
  }, [network, syncToReactFlow])
  
  const connect = useCallback((fromId: string, toId: string, type?: 'bidirectional' | 'directed'): Wire => {
    const wire = network.connect(fromId, toId, type)
    syncToReactFlow()
    return wire
  }, [network, syncToReactFlow])
  
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