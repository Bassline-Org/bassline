import { useState, useEffect } from 'react'
import { getNetworkClient } from '~/network/client'
import type { GroupState, Contact, Change, Group } from '@bassline/core'

/**
 * Hook to get and subscribe to NetworkClient singleton
 */
export function useNetworkClient() {
  return getNetworkClient()
}

/**
 * Hook to subscribe to group state changes
 */
export function useGroupState(groupId: string, initialState?: GroupState) {
  const [state, setState] = useState<GroupState | null>(initialState || null)
  const [loading, setLoading] = useState(!initialState)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    const client = getNetworkClient()
    
    // Reset state when groupId changes
    setState(initialState || ({} as GroupState))
    setLoading(true)
    setError(null)
    
    // Always fetch fresh data for the group
    console.log(`[useGroupState] Initial fetch for group ${groupId}`)
    client.getState(groupId)
      .then(groupState => {
        console.log(`[useGroupState] Initial state loaded for group ${groupId}:`, groupState)
        setState(groupState)
        setLoading(false)
      })
      .catch(err => {
        console.error(`[useGroupState] Error loading initial state:`, err)
        setError(err)
        setLoading(false)
      })
    
    // Subscribe to changes that affect this group
    const handleChanges = (changes: Array<Change | { type: 'state-update', data: any }>) => {
      console.log(`[useGroupState] Received changes for group ${groupId}:`, changes)
      
      const relevantChanges = changes.filter(change => {
        // Check if change affects this group
        switch (change.type) {
          case 'contact-added': {
            // Data: { ...contact, groupId }
            const data = change.data as { groupId: string }
            console.log(`[useGroupState] Contact added in group ${data.groupId}, looking for: ${groupId}`)
            return data.groupId === groupId
          }
          case 'contact-updated': {
            // Data: { contactId, groupId, updates }
            const data = change.data as { groupId: string }
            console.log(`[useGroupState] Contact updated in group ${data.groupId}, looking for: ${groupId}`)
            return data.groupId === groupId
          }
          case 'contact-removed': {
            // Data: { contactId, groupId }
            const data = change.data as { contactId: string; groupId: string }
            console.log(`[useGroupState] Contact removed from group ${data.groupId}, looking for: ${groupId}`)
            return data.groupId === groupId
          }
          case 'wire-added': {
            // Data: { ...wire, groupId }
            const data = change.data as { groupId: string }
            console.log(`[useGroupState] Wire added in group ${data.groupId}, looking for: ${groupId}`)
            return data.groupId === groupId
          }
          case 'wire-removed': {
            // Data: { wireId, groupId }
            const data = change.data as { wireId: string; groupId: string }
            console.log(`[useGroupState] Wire removed from group ${data.groupId}, looking for: ${groupId}`)
            return data.groupId === groupId
          }
          case 'group-updated': {
            // Data: { groupId, group }
            const data = change.data as { groupId: string }
            console.log(`[useGroupState] Group updated: ${data.groupId}, looking for: ${groupId}`)
            return data.groupId === groupId
          }
          case 'group-added': {
            // Data: group object with parentId
            const newGroup = change.data as Group
            console.log(`[useGroupState] Group added with parentId: ${newGroup.parentId}, looking for: ${groupId}`)
            // This is relevant if a subgroup was added to our group
            return newGroup.parentId === groupId
          }
          case 'group-removed': {
            // Data: { groupId }
            const data = change.data as { groupId: string }
            // Need to check if this was a subgroup of our group
            // For now, we'll refresh if any group is removed to be safe
            // TODO: Track parent-child relationships better
            console.log(`[useGroupState] Group removed: ${data.groupId}`)
            return true // Refresh to be safe
          }
          case 'state-update': {
            // This is from the remote client's polling
            // Always relevant since we subscribed to this specific group
            console.log(`[useGroupState] State update received for group ${groupId}`)
            return true
          }
          default:
            console.warn(`[useGroupState] Unknown change type: ${(change as any).type}`)
            return false
        }
      })
      
      console.log(`[useGroupState] Found ${relevantChanges.length} relevant changes`)
      
      if (relevantChanges.length > 0) {
        // Check if we have a state-update change with the full state
        const stateUpdateChange = relevantChanges.find(c => c.type === 'state-update')
        if (stateUpdateChange && stateUpdateChange.data) {
          // Use the state directly from the change
          console.log(`[useGroupState] Using state from state-update change for group ${groupId}`)
          setState(stateUpdateChange.data)
        } else {
          // Apply incremental updates instead of full refetch
          console.log(`[useGroupState] Applying incremental updates for group ${groupId}:`, relevantChanges)
          
          setState(currentState => {
            if (!currentState) return currentState
            
            // Create a new state object with selective updates
            let newState = { ...currentState }
            let needsFullRefetch = false
            
            for (const change of relevantChanges) {
              console.log(`[useGroupState] Processing change:`, change.type, change.data)
              
              switch (change.type) {
                case 'contact-updated': {
                  const { contactId, value } = change.data as { contactId: string, value: any, groupId: string }
                  
                  // Update contact in-place if it exists
                  if (currentState.contacts instanceof Map) {
                    const existingContact = currentState.contacts.get(contactId)
                    if (existingContact) {
                      const newContacts = new Map(currentState.contacts)
                      newContacts.set(contactId, { ...existingContact, content: value })
                      newState = { ...newState, contacts: newContacts }
                      console.log(`[useGroupState] Updated contact ${contactId} content to:`, value)
                    } else {
                      needsFullRefetch = true // Contact not found, need full state
                    }
                  } else {
                    needsFullRefetch = true // Unexpected contacts format
                  }
                  break
                }
                
                case 'contact-added':
                case 'contact-removed':
                case 'wire-added':
                case 'wire-removed':
                case 'group-added':
                case 'group-removed':
                case 'group-updated': {
                  // Structural changes require full refetch for now
                  needsFullRefetch = true
                  console.log(`[useGroupState] Structural change detected:`, change.type)
                  break
                }
              }
            }
            
            // If any structural changes occurred, fall back to full refetch
            if (needsFullRefetch) {
              console.log(`[useGroupState] Structural changes detected, performing full refetch for group ${groupId}`)
              client.getState(groupId)
                .then(fullState => {
                  console.log(`[useGroupState] Full state refreshed for group ${groupId}`)
                  setState(fullState)
                })
                .catch(err => {
                  console.error(`[useGroupState] Error fetching full state:`, err)
                  setError(err)
                })
              return currentState // Keep current state until full fetch completes
            }
            
            return newState
          })
        }
      } else {
        console.log(`[useGroupState] No relevant changes for group ${groupId}`)
      }
    }
    
    // Subscribe to group changes
    const unsubscribe = client.subscribe(groupId, handleChanges)
    
    return unsubscribe
  }, [groupId, initialState])
  
  return { state, loading, error }
}

/**
 * Hook to subscribe to individual contact changes
 */
export function useContact(contactId: string, initialContact?: Contact) {
  const [contact, setContact] = useState<Contact | null>(initialContact || null)
  const [loading, setLoading] = useState(!initialContact)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    const client = getNetworkClient()
    
    // Load initial data if not provided
    if (!initialContact) {
      client.getContact(contactId)
        .then(contactData => {
          setContact(contactData || null)
          setLoading(false)
        })
        .catch(err => {
          setError(err)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
    
    // Subscribe to changes for this specific contact
    const unsubscribe = client.subscribe((changes: Change[]) => {
      const contactChange = changes.find(change => 
        change.type === 'contact-updated' && 
        (change.data as any).contactId === contactId
      )
      
      if (contactChange) {
        // Update contact directly from change data
        const updatedContact = (contactChange.data as any).contact
        if (updatedContact) {
          setContact(updatedContact)
        } else {
          // Fallback: refetch contact data
          client.getContact(contactId)
            .then(contactData => setContact(contactData || null))
            .catch(setError)
        }
      }
    })
    
    return unsubscribe
  }, [contactId, initialContact])
  
  return { contact, loading, error }
}

/**
 * Hook to get all contacts in a group with real-time updates
 */
export function useGroupContacts(groupId: string, initialContacts?: Contact[]) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts || [])
  const [loading, setLoading] = useState(!initialContacts)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    const client = getNetworkClient()
    
    // Load initial data if not provided
    if (!initialContacts) {
      client.getState(groupId)
        .then(groupState => {
          const contactList = Array.from(groupState.contacts.values())
          setContacts(contactList)
          setLoading(false)
        })
        .catch(err => {
          setError(err)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
    
    // Subscribe to contact changes in this group
    const unsubscribe = client.subscribe((changes: Change[]) => {
      const groupChanges = changes.filter(change => {
        switch (change.type) {
          case 'contact-added':
          case 'contact-updated':
          case 'contact-removed': {
            const data = change.data as { groupId: string }
            return data.groupId === groupId
          }
          default:
            return false
        }
      })
      
      if (groupChanges.length > 0) {
        // Refresh contacts list
        client.getState(groupId)
          .then(groupState => {
            const contactList = Array.from(groupState.contacts.values())
            setContacts(contactList)
          })
          .catch(setError)
      }
    })
    
    return unsubscribe
  }, [groupId, initialContacts])
  
  return { contacts, loading, error }
}