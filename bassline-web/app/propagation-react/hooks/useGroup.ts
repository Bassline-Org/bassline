import { useState, useEffect, useCallback } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import type { ContactGroup, Contact, Wire, Position, ContactId } from '~/propagation-core'
import { PrimitiveGadget } from '~/propagation-core/primitives'
import { useNavigationState } from './useURLState'

interface UseGroupReturn {
  group: ContactGroup | null
  name: string
  contacts: Contact[]
  wires: Wire[]
  subgroups: ContactGroup[]
  boundaryContacts: Contact[]
  inputContacts: Contact[]
  outputContacts: Contact[]
  isPrimitive: boolean
  position: Position
  
  // Mutations
  rename: (name: string) => void
  setPosition: (position: Position) => void
  addContact: (position: Position) => Contact | null
  addBoundaryContact: (position: Position, direction: 'input' | 'output', name?: string) => Contact | null
  removeContact: (contactId: string) => boolean
  connect: (fromId: string, toId: string, type?: 'bidirectional' | 'directed') => Wire | null
  removeWire: (wireId: string) => boolean
  navigate: () => void
  remove: () => void
}

export function useGroup(groupId: string | null | undefined): UseGroupReturn {
  const { network, syncToReactFlow } = useNetworkContext()
  const { navigateToGroup: urlNavigateToGroup } = useNavigationState()
  const [group, setGroup] = useState<ContactGroup | null>(null)
  
  // Find and track the group
  useEffect(() => {
    if (!groupId) {
      setGroup(null)
      return
    }
    
    const foundGroup = network.findGroup(groupId)
    setGroup(foundGroup || null)
    
    // TODO: In the future, subscribe to group changes here
  }, [groupId, network])
  
  // Helper to get contacts/wires/subgroups
  const getContacts = useCallback((): Contact[] => {
    if (!group) return []
    return Array.from(group.contacts.values())
  }, [group])
  
  const getWires = useCallback((): Wire[] => {
    if (!group) return []
    return Array.from(group.wires.values())
  }, [group])
  
  const getSubgroups = useCallback((): ContactGroup[] => {
    if (!group) return []
    return Array.from(group.subgroups.values())
  }, [group])
  
  const getBoundaryContacts = useCallback((): Contact[] => {
    if (!group) return []
    const boundary = group.getBoundaryContacts()
    return [...boundary.inputs, ...boundary.outputs]
  }, [group])
  
  const getInputContacts = useCallback((): Contact[] => {
    if (!group) return []
    return group.getBoundaryContacts().inputs
  }, [group])
  
  const getOutputContacts = useCallback((): Contact[] => {
    if (!group) return []
    return group.getBoundaryContacts().outputs
  }, [group])
  
  // Mutations
  const rename = useCallback((name: string) => {
    if (!group) return
    group.name = name
    syncToReactFlow()
  }, [group, syncToReactFlow])
  
  const setPosition = useCallback((position: Position) => {
    if (!group) return
    group.position = position
    syncToReactFlow()
  }, [group, syncToReactFlow])
  
  const addContact = useCallback((position: Position): Contact | null => {
    if (!group) return null
    
    // Temporarily switch to this group's context
    const prevGroup = network.currentGroup
    network.currentGroup = group
    
    const contact = network.addContact(position)
    
    // Switch back
    network.currentGroup = prevGroup
    
    syncToReactFlow()
    return contact
  }, [group, network, syncToReactFlow])
  
  const addBoundaryContact = useCallback((position: Position, direction: 'input' | 'output', name?: string): Contact | null => {
    if (!group) return null
    
    // Temporarily switch to this group's context
    const prevGroup = network.currentGroup
    network.currentGroup = group
    
    const contact = network.addBoundaryContact(position, direction, name)
    
    // Switch back
    network.currentGroup = prevGroup
    
    syncToReactFlow()
    return contact
  }, [group, network, syncToReactFlow])
  
  const removeContact = useCallback((contactId: string): boolean => {
    if (!group) return false
    
    const result = group.removeContact(contactId)
    syncToReactFlow()
    return result
  }, [group, syncToReactFlow])
  
  const connect = useCallback((fromId: string, toId: string, type?: 'bidirectional' | 'directed'): Wire | null => {
    if (!group) return null
    
    // Temporarily switch to this group's context
    const prevGroup = network.currentGroup
    network.currentGroup = group
    
    const wire = network.connect(fromId, toId, type)
    
    // Switch back
    network.currentGroup = prevGroup
    
    syncToReactFlow()
    return wire
  }, [group, network, syncToReactFlow])
  
  const removeWire = useCallback((wireId: string): boolean => {
    if (!group) return false
    
    group.removeWire(wireId)
    syncToReactFlow()
    return true
  }, [group, syncToReactFlow])
  
  const navigate = useCallback(() => {
    if (!group || group instanceof PrimitiveGadget) return
    
    // Build navigation path
    const path: string[] = []
    let current: ContactGroup | null = group
    while (current && current !== network.rootGroup) {
      path.unshift(current.id)
      current = current.parent ?? null
    }
    
    urlNavigateToGroup(group.id, path.join('/'))
  }, [group, network, urlNavigateToGroup])
  
  const remove = useCallback(() => {
    if (!group || !group.parent) return
    
    group.parent.removeSubgroup(group.id)
    syncToReactFlow()
  }, [group, syncToReactFlow])
  
  return {
    group,
    name: group?.name ?? '',
    contacts: getContacts(),
    wires: getWires(),
    subgroups: getSubgroups(),
    boundaryContacts: getBoundaryContacts(),
    inputContacts: getInputContacts(),
    outputContacts: getOutputContacts(),
    isPrimitive: group instanceof PrimitiveGadget,
    position: group?.position ?? { x: 0, y: 0 },
    
    // Mutations
    rename,
    setPosition,
    addContact,
    addBoundaryContact,
    removeContact,
    connect,
    removeWire,
    navigate,
    remove
  }
}