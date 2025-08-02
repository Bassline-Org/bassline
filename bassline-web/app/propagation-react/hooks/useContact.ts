import { useState, useEffect, useCallback } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import type { Contact, ContactId, Position, BlendMode } from '~/propagation-core'
import type { Contradiction } from '~/propagation-core/types'

interface UseContactReturn {
  contact: Contact | null
  content: any
  blendMode: 'accept-last' | 'merge'
  isBoundary: boolean
  isContradicted: boolean
  lastContradiction: Contradiction | null
  position: Position
  name: string | undefined
  
  // Mutations that auto-sync
  setContent: (content: any) => void
  setBlendMode: (mode: BlendMode) => void
  setPosition: (position: Position) => void
  setName: (name: string | undefined) => void
  remove: () => void
}

export function useContact(contactId: string | null | undefined): UseContactReturn {
  const { network, syncToReactFlow } = useNetworkContext()
  const [contact, setContact] = useState<Contact | null>(null)
  
  // Find and track the contact
  useEffect(() => {
    if (!contactId) {
      setContact(null)
      return
    }
    
    const foundContact = network.findContact(contactId)
    setContact(foundContact || null)
    
    // TODO: In the future, subscribe to contact changes here
    // For now, we rely on manual syncs after mutations
  }, [contactId, network])
  
  // Mutation callbacks with auto-sync
  const setContent = useCallback((content: any) => {
    if (!contact) return
    contact.setContent(content)
    syncToReactFlow()
  }, [contact, syncToReactFlow])
  
  const setBlendMode = useCallback((mode: BlendMode) => {
    if (!contact) return
    contact.setBlendMode(mode)
    syncToReactFlow()
  }, [contact, syncToReactFlow])
  
  const setPosition = useCallback((position: Position) => {
    if (!contact) return
    contact.position = position
    syncToReactFlow()
  }, [contact, syncToReactFlow])
  
  const setName = useCallback((name: string | undefined) => {
    if (!contact) return
    contact.name = name
    syncToReactFlow()
  }, [contact, syncToReactFlow])
  
  const remove = useCallback(() => {
    if (!contact) return
    network.removeContact(contact.id)
    syncToReactFlow()
  }, [contact, network, syncToReactFlow])
  
  // Return a stable object with current values
  return {
    contact,
    content: contact?.content ?? undefined,
    blendMode: contact?.blendMode ?? 'accept-last',
    isBoundary: contact?.isBoundary ?? false,
    isContradicted: contact?.lastContradiction !== null,
    lastContradiction: contact?.lastContradiction ?? null,
    position: contact?.position ?? { x: 0, y: 0 },
    name: contact?.name,
    
    // Mutations
    setContent,
    setBlendMode,
    setPosition,
    setName,
    remove
  }
}