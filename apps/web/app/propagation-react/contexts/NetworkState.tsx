import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// Normalized state types
export interface ContactState {
  id: string
  content: any
  blendMode: 'accept-last' | 'merge'
  position: { x: number; y: number }
  name?: string
  isBoundary: boolean
  boundaryDirection?: 'input' | 'output'
  groupId: string
  lastContradiction?: { reason: string } | null
}

export interface GroupState {
  id: string
  name: string
  position: { x: number; y: number }
  parentId?: string
  contactIds: string[]
  subgroupIds: string[]
  boundaryContactIds: string[]
  isPrimitive: boolean
}

export interface WireState {
  id: string
  fromId: string
  toId: string
  type: 'bidirectional' | 'directed'
  groupId: string
}

export interface NetworkState {
  contacts: Record<string, ContactState>
  groups: Record<string, GroupState>
  wires: Record<string, WireState>
  currentGroupId: string
  rootGroupId: string
  selectedContactIds: string[]
  selectedGroupIds: string[]
}

interface NetworkStateContextValue {
  state: NetworkState
  
  // Contact actions
  updateContact: (id: string, updates: Partial<ContactState>) => void
  addContact: (groupId: string, contact: Omit<ContactState, 'id' | 'groupId'>) => string
  removeContact: (id: string) => void
  moveContactsToGroup: (contactIds: string[], targetGroupId: string) => void
  
  // Group actions
  updateGroup: (id: string, updates: Partial<GroupState>) => void
  addGroup: (parentId: string, group: Omit<GroupState, 'id' | 'parentId'>) => string
  removeGroup: (id: string) => void
  extractContactsToNewGroup: (contactIds: string[], groupName: string) => string
  inlineGroup: (groupId: string) => void
  
  // Wire actions
  addWire: (groupId: string, wire: Omit<WireState, 'id' | 'groupId'>) => string
  removeWire: (id: string) => void
  
  // Navigation
  setCurrentGroup: (groupId: string) => void
  
  // Selection
  selectContact: (id: string, addToSelection?: boolean) => void
  selectGroup: (id: string, addToSelection?: boolean) => void
  clearSelection: () => void
}

const NetworkStateContext = createContext<NetworkStateContextValue | null>(null)

export function useNetworkState() {
  const context = useContext(NetworkStateContext)
  if (!context) {
    throw new Error('useNetworkState must be used within NetworkStateProvider')
  }
  return context
}

function generateId(): string {
  return crypto.randomUUID()
}

export function NetworkStateProvider({ children, initialGroupId }: { children: ReactNode; initialGroupId?: string | null }) {
  
  const [state, setState] = useState<NetworkState>(() => {
    // Use predictable IDs to avoid hydration mismatch
    const rootGroupId = 'root-group'
    const contact1Id = 'contact-1'
    const contact2Id = 'contact-2'
    const wireId = 'wire-1'
    
    const initialState = {
      contacts: {
        [contact1Id]: {
          id: contact1Id,
          content: 'Hello',
          blendMode: 'accept-last',
          position: { x: 100, y: 100 },
          isBoundary: false,
          groupId: rootGroupId
        },
        [contact2Id]: {
          id: contact2Id,
          content: 'World',
          blendMode: 'accept-last', 
          position: { x: 300, y: 100 },
          isBoundary: false,
          groupId: rootGroupId
        }
      },
      groups: {
        [rootGroupId]: {
          id: rootGroupId,
          name: 'Root',
          position: { x: 0, y: 0 },
          contactIds: [contact1Id, contact2Id],
          subgroupIds: [],
          boundaryContactIds: [],
          isPrimitive: false
        }
      },
      wires: {
        [wireId]: {
          id: wireId,
          fromId: contact1Id,
          toId: contact2Id,
          type: 'bidirectional',
          groupId: rootGroupId
        }
      },
      currentGroupId: rootGroupId, // Will be set after mount if initialGroupId provided
      rootGroupId,
      selectedContactIds: [],
      selectedGroupIds: []
    }
    
    return initialState
  })
  
  // Set initial group if provided
  useEffect(() => {
    if (initialGroupId && state.groups[initialGroupId] && state.currentGroupId !== initialGroupId) {
      setState(prev => ({ ...prev, currentGroupId: initialGroupId }))
    }
  }, [initialGroupId])
  
  // URL updates should be handled by the component that has access to router
  // This makes the NetworkStateProvider work in both SSR and client contexts
  
  const updateContact = useCallback((id: string, updates: Partial<ContactState>) => {
    setState(prev => {
      const newState = {
        ...prev,
        contacts: {
          ...prev.contacts,
          [id]: { ...prev.contacts[id], ...updates }
        }
      }
      
      // If content changed, propagate to connected contacts
      if ('content' in updates && updates.content !== prev.contacts[id]?.content) {
        // Find all wires connected to this contact
        const connectedWires = Object.values(prev.wires).filter(
          wire => wire.fromId === id || wire.toId === id
        )
        
        // Propagate to connected contacts
        connectedWires.forEach(wire => {
          const targetId = wire.fromId === id ? wire.toId : wire.fromId
          const targetContact = newState.contacts[targetId]
          
          if (targetContact && wire.type === 'bidirectional') {
            // Apply blend mode logic
            if (targetContact.blendMode === 'merge' && targetContact.content !== undefined) {
              // For now, just overwrite - proper merge logic would go here
              newState.contacts[targetId] = {
                ...targetContact,
                content: updates.content
              }
            } else if (targetContact.blendMode === 'accept-last') {
              newState.contacts[targetId] = {
                ...targetContact,
                content: updates.content
              }
            }
          }
        })
      }
      
      return newState
    })
  }, [])
  
  const addContact = useCallback((groupId: string, contactData: Omit<ContactState, 'id' | 'groupId'>) => {
    const id = generateId()
    const contact: ContactState = { ...contactData, id, groupId }
    
    setState(prev => ({
      ...prev,
      contacts: { ...prev.contacts, [id]: contact },
      groups: {
        ...prev.groups,
        [groupId]: {
          ...prev.groups[groupId],
          contactIds: [...prev.groups[groupId].contactIds, id],
          ...(contact.isBoundary && {
            boundaryContactIds: [...prev.groups[groupId].boundaryContactIds, id]
          })
        }
      }
    }))
    
    return id
  }, [])
  
  const removeContact = useCallback((id: string) => {
    setState(prev => {
      const contact = prev.contacts[id]
      if (!contact) return prev
      
      const { [id]: removed, ...remainingContacts } = prev.contacts
      
      // Remove from group's contact lists
      const group = prev.groups[contact.groupId]
      const updatedGroup = {
        ...group,
        contactIds: group.contactIds.filter(cId => cId !== id),
        boundaryContactIds: group.boundaryContactIds.filter(cId => cId !== id)
      }
      
      // Remove any wires connected to this contact
      const remainingWires = Object.fromEntries(
        Object.entries(prev.wires).filter(([_, wire]) => 
          wire.fromId !== id && wire.toId !== id
        )
      )
      
      return {
        ...prev,
        contacts: remainingContacts,
        groups: { ...prev.groups, [contact.groupId]: updatedGroup },
        wires: remainingWires
      }
    })
  }, [])
  
  const updateGroup = useCallback((id: string, updates: Partial<GroupState>) => {
    setState(prev => ({
      ...prev,
      groups: {
        ...prev.groups,
        [id]: { ...prev.groups[id], ...updates }
      }
    }))
  }, [])
  
  const addGroup = useCallback((parentId: string, groupData: Omit<GroupState, 'id' | 'parentId'>) => {
    const id = generateId()
    const group: GroupState = { ...groupData, id, parentId }
    
    setState(prev => ({
      ...prev,
      groups: {
        ...prev.groups,
        [id]: group,
        [parentId]: {
          ...prev.groups[parentId],
          subgroupIds: [...prev.groups[parentId].subgroupIds, id]
        }
      }
    }))
    
    return id
  }, [])
  
  const removeGroup = useCallback((id: string) => {
    setState(prev => {
      const group = prev.groups[id]
      if (!group) return prev
      
      // Remove recursively (all subgroups, contacts, wires)
      const toRemove = new Set([id])
      const collectChildren = (groupId: string) => {
        const g = prev.groups[groupId]
        if (!g) return
        g.subgroupIds.forEach(subId => {
          toRemove.add(subId)
          collectChildren(subId)
        })
      }
      collectChildren(id)
      
      // Remove all groups and their contacts/wires
      const remainingGroups = Object.fromEntries(
        Object.entries(prev.groups).filter(([gId]) => !toRemove.has(gId))
      )
      
      const remainingContacts = Object.fromEntries(
        Object.entries(prev.contacts).filter(([_, contact]) => !toRemove.has(contact.groupId))
      )
      
      const remainingWires = Object.fromEntries(
        Object.entries(prev.wires).filter(([_, wire]) => !toRemove.has(wire.groupId))
      )
      
      // Remove from parent's subgroup list
      if (group.parentId) {
        const parent = prev.groups[group.parentId]
        remainingGroups[group.parentId] = {
          ...parent,
          subgroupIds: parent.subgroupIds.filter(subId => subId !== id)
        }
      }
      
      return {
        ...prev,
        groups: remainingGroups,
        contacts: remainingContacts,
        wires: remainingWires
      }
    })
  }, [])
  
  const addWire = useCallback((groupId: string, wireData: Omit<WireState, 'id' | 'groupId'>) => {
    const id = generateId()
    const wire: WireState = { ...wireData, id, groupId }
    
    setState(prev => {
      const newState = {
        ...prev,
        wires: { ...prev.wires, [id]: wire }
      }
      
      // Propagate existing content through new wire
      if (wire.type === 'bidirectional') {
        const fromContact = prev.contacts[wire.fromId]
        const toContact = prev.contacts[wire.toId]
        
        // If fromContact has content and toContact doesn't, propagate
        if (fromContact?.content !== undefined && toContact?.content === undefined) {
          newState.contacts[wire.toId] = {
            ...toContact,
            content: fromContact.content
          }
        }
        // If toContact has content and fromContact doesn't, propagate back
        else if (toContact?.content !== undefined && fromContact?.content === undefined) {
          newState.contacts[wire.fromId] = {
            ...fromContact,
            content: toContact.content
          }
        }
      }
      
      return newState
    })
    
    return id
  }, [])
  
  const removeWire = useCallback((id: string) => {
    setState(prev => {
      const { [id]: removed, ...remainingWires } = prev.wires
      return { ...prev, wires: remainingWires }
    })
  }, [])
  
  const setCurrentGroup = useCallback((groupId: string) => {
    setState(prev => ({ ...prev, currentGroupId: groupId }))
  }, [])
  
  const selectContact = useCallback((id: string, addToSelection = false) => {
    setState(prev => ({
      ...prev,
      selectedContactIds: addToSelection 
        ? prev.selectedContactIds.includes(id)
          ? prev.selectedContactIds.filter(contactId => contactId !== id)
          : [...prev.selectedContactIds, id]
        : [id],
      selectedGroupIds: addToSelection ? prev.selectedGroupIds : []
    }))
  }, [])
  
  const selectGroup = useCallback((id: string, addToSelection = false) => {
    setState(prev => ({
      ...prev,
      selectedGroupIds: addToSelection
        ? prev.selectedGroupIds.includes(id)
          ? prev.selectedGroupIds.filter(groupId => groupId !== id)
          : [...prev.selectedGroupIds, id]
        : [id],
      selectedContactIds: addToSelection ? prev.selectedContactIds : []
    }))
  }, [])
  
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedContactIds: [],
      selectedGroupIds: []
    }))
  }, [])
  
  const moveContactsToGroup = useCallback((contactIds: string[], targetGroupId: string) => {
    setState(prev => {
      const updatedContacts = { ...prev.contacts }
      const updatedGroups = { ...prev.groups }
      
      contactIds.forEach(contactId => {
        const contact = updatedContacts[contactId]
        if (contact) {
          const oldGroupId = contact.groupId
          
          // Remove from old group
          if (updatedGroups[oldGroupId]) {
            updatedGroups[oldGroupId] = {
              ...updatedGroups[oldGroupId],
              contactIds: updatedGroups[oldGroupId].contactIds.filter(id => id !== contactId)
            }
          }
          
          // Add to new group
          if (updatedGroups[targetGroupId]) {
            updatedGroups[targetGroupId] = {
              ...updatedGroups[targetGroupId],
              contactIds: [...updatedGroups[targetGroupId].contactIds, contactId]
            }
          }
          
          // Update contact's group
          updatedContacts[contactId] = {
            ...contact,
            groupId: targetGroupId
          }
        }
      })
      
      return {
        ...prev,
        contacts: updatedContacts,
        groups: updatedGroups
      }
    })
  }, [])
  
  const extractContactsToNewGroup = useCallback((contactIds: string[], groupName: string) => {
    const groupId = generateId()
    const nodes = (window as any).reactFlowInstance?.getNodes() || []
    const selectedNodes = nodes.filter((n: any) => contactIds.includes(n.id))
    
    // Calculate center position
    let centerX = 100, centerY = 100
    if (selectedNodes.length > 0) {
      centerX = selectedNodes.reduce((sum: number, n: any) => sum + n.position.x, 0) / selectedNodes.length
      centerY = selectedNodes.reduce((sum: number, n: any) => sum + n.position.y, 0) / selectedNodes.length
    }
    
    setState(prev => {
      const updatedGroups = { ...prev.groups }
      const updatedContacts = { ...prev.contacts }
      const updatedWires = { ...prev.wires }
      
      // Create the new group
      const newGroup: GroupState = {
        id: groupId,
        name: groupName,
        parentId: prev.currentGroupId,
        position: { x: centerX - 60, y: centerY - 30 },
        contactIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        isPrimitive: false
      }
      
      updatedGroups[groupId] = newGroup
      
      // Add to parent group
      updatedGroups[prev.currentGroupId] = {
        ...updatedGroups[prev.currentGroupId],
        subgroupIds: [...updatedGroups[prev.currentGroupId].subgroupIds, groupId]
      }
      
      // Check for external connections
      const externalConnections = new Map<string, Set<string>>()
      
      Object.values(prev.wires).forEach(wire => {
        const fromInGroup = contactIds.includes(wire.fromId)
        const toInGroup = contactIds.includes(wire.toId)
        
        if (fromInGroup && !toInGroup) {
          if (!externalConnections.has(wire.fromId)) {
            externalConnections.set(wire.fromId, new Set())
          }
          externalConnections.get(wire.fromId)!.add(wire.toId)
        } else if (!fromInGroup && toInGroup) {
          if (!externalConnections.has(wire.toId)) {
            externalConnections.set(wire.toId, new Set())
          }
          externalConnections.get(wire.toId)!.add(wire.fromId)
        }
      })
      
      // Create boundary contacts for external connections
      externalConnections.forEach((externalIds, internalId) => {
        const internalContact = updatedContacts[internalId]
        const boundaryId = generateId()
        
        // Create boundary contact
        updatedContacts[boundaryId] = {
          id: boundaryId,
          groupId,
          content: internalContact.content,
          blendMode: 'accept-last',
          position: {
            x: internalContact.position.x,
            y: internalContact.position.y - 50
          },
          isBoundary: true,
          boundaryDirection: 'input'
        }
        
        newGroup.boundaryContactIds.push(boundaryId)
        
        // Create internal wire
        const internalWireId = generateId()
        updatedWires[internalWireId] = {
          id: internalWireId,
          groupId,
          fromId: boundaryId,
          toId: internalId,
          type: 'bidirectional'
        }
        
        // Update external wires to connect to boundary
        Object.entries(updatedWires).forEach(([wireId, wire]) => {
          if (wire.fromId === internalId && externalIds.has(wire.toId)) {
            updatedWires[wireId] = { ...wire, fromId: boundaryId }
          } else if (wire.toId === internalId && externalIds.has(wire.fromId)) {
            updatedWires[wireId] = { ...wire, toId: boundaryId }
          }
        })
      })
      
      // Move contacts to new group
      contactIds.forEach(contactId => {
        const contact = updatedContacts[contactId]
        if (contact) {
          const oldGroupId = contact.groupId
          
          // Remove from old group
          updatedGroups[oldGroupId] = {
            ...updatedGroups[oldGroupId],
            contactIds: updatedGroups[oldGroupId].contactIds.filter(id => id !== contactId)
          }
          
          // Add to new group and adjust position
          updatedContacts[contactId] = {
            ...contact,
            groupId,
            position: {
              x: contact.position.x - centerX + 60,
              y: contact.position.y - centerY + 30
            }
          }
          
          newGroup.contactIds.push(contactId)
        }
      })
      
      return {
        ...prev,
        contacts: updatedContacts,
        groups: updatedGroups,
        wires: updatedWires,
        selectedContactIds: [],
        selectedGroupIds: [groupId]
      }
    })
    
    return groupId
  }, [])
  
  const inlineGroup = useCallback((groupId: string) => {
    setState(prev => {
      const group = prev.groups[groupId]
      if (!group) return prev
      
      const parentGroup = prev.groups[group.parentId]
      if (!parentGroup) return prev
      
      const updatedGroups = { ...prev.groups }
      const updatedContacts = { ...prev.contacts }
      const updatedWires = { ...prev.wires }
      
      // Move all contacts from group to parent
      group.contactIds.forEach(contactId => {
        const contact = updatedContacts[contactId]
        if (contact) {
          // Update contact's group and adjust position
          updatedContacts[contactId] = {
            ...contact,
            groupId: group.parentId,
            position: {
              x: contact.position.x + group.position.x,
              y: contact.position.y + group.position.y
            }
          }
        }
      })
      
      // Move all subgroups to parent
      group.subgroupIds.forEach(subgroupId => {
        const subgroup = updatedGroups[subgroupId]
        if (subgroup) {
          updatedGroups[subgroupId] = {
            ...subgroup,
            parentId: group.parentId,
            position: {
              x: subgroup.position.x + group.position.x,
              y: subgroup.position.y + group.position.y
            }
          }
        }
      })
      
      // Update parent group
      updatedGroups[group.parentId] = {
        ...parentGroup,
        contactIds: [...parentGroup.contactIds, ...group.contactIds],
        subgroupIds: [
          ...parentGroup.subgroupIds.filter(id => id !== groupId),
          ...group.subgroupIds
        ]
      }
      
      // Move all wires from group to parent
      Object.entries(updatedWires).forEach(([wireId, wire]) => {
        if (wire.groupId === groupId) {
          updatedWires[wireId] = { ...wire, groupId: group.parentId }
        }
      })
      
      // Remove boundary contacts that were part of the inlined group
      group.boundaryContactIds.forEach(boundaryId => {
        // Find wires connected to this boundary
        const connectedWires = Object.entries(updatedWires).filter(
          ([_, wire]) => wire.fromId === boundaryId || wire.toId === boundaryId
        )
        
        // For each wire, connect directly to the internal contact
        connectedWires.forEach(([wireId, wire]) => {
          // Find the internal contact this boundary was connected to
          const internalWire = Object.values(updatedWires).find(
            w => (w.fromId === boundaryId && group.contactIds.includes(w.toId)) ||
                 (w.toId === boundaryId && group.contactIds.includes(w.fromId))
          )
          
          if (internalWire) {
            const internalContactId = internalWire.fromId === boundaryId ? internalWire.toId : internalWire.fromId
            
            // Update the external wire to connect directly to the internal contact
            if (wire.fromId === boundaryId) {
              updatedWires[wireId] = { ...wire, fromId: internalContactId }
            } else {
              updatedWires[wireId] = { ...wire, toId: internalContactId }
            }
          }
        })
        
        // Remove the boundary contact
        delete updatedContacts[boundaryId]
      })
      
      // Remove internal wires that connected boundaries to internal contacts
      Object.entries(updatedWires).forEach(([wireId, wire]) => {
        if (group.boundaryContactIds.includes(wire.fromId) || group.boundaryContactIds.includes(wire.toId)) {
          delete updatedWires[wireId]
        }
      })
      
      // Remove the group
      delete updatedGroups[groupId]
      
      return {
        ...prev,
        groups: updatedGroups,
        contacts: updatedContacts,
        wires: updatedWires,
        selectedGroupIds: prev.selectedGroupIds.filter(id => id !== groupId)
      }
    })
  }, [])
  
  const value: NetworkStateContextValue = {
    state,
    updateContact,
    addContact,
    removeContact,
    moveContactsToGroup,
    updateGroup,
    addGroup,
    removeGroup,
    extractContactsToNewGroup,
    inlineGroup,
    addWire,
    removeWire,
    setCurrentGroup,
    selectContact,
    selectGroup,
    clearSelection
  }
  
  return (
    <NetworkStateContext.Provider value={value}>
      {children}
    </NetworkStateContext.Provider>
  )
}