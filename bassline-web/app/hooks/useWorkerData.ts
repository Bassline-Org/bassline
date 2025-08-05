import { useState, useEffect } from 'react'
import { getNetworkClient } from '~/network/client'
import type { GroupState, Contact, Change } from '~/propagation-core-v2/types'

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
    
    // Load initial data if not provided
    if (!initialState) {
      client.getState(groupId)
        .then(groupState => {
          setState(groupState)
          setLoading(false)
        })
        .catch(err => {
          setError(err)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
    
    // Subscribe to changes that affect this group
    const unsubscribe = client.subscribe((changes: Change[]) => {
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
          default:
            console.warn(`[useGroupState] Unknown change type: ${(change as any).type}`)
            return false
        }
      })
      
      console.log(`[useGroupState] Found ${relevantChanges.length} relevant changes`)
      
      if (relevantChanges.length > 0) {
        // Refresh group state when relevant changes occur
        client.getState(groupId)
          .then(setState)
          .catch(setError)
      }
    })
    
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