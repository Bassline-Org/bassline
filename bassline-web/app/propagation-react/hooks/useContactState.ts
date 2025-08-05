import { useCallback } from 'react'
import { useNetworkState, type ContactState } from '../contexts/NetworkState'

interface UseContactStateReturn {
  contact: ContactState | null
  content: any
  blendMode: 'accept-last' | 'merge'
  isBoundary: boolean
  boundaryDirection: 'input' | 'output' | undefined
  isContradicted: boolean
  lastContradiction: { reason: string } | null
  position: { x: number; y: number }
  name: string | undefined
  
  // Actions - these create new state instead of mutating
  setContent: (content: any) => void
  setBlendMode: (mode: 'accept-last' | 'merge') => void
  setPosition: (position: { x: number; y: number }) => void
  setName: (name: string | undefined) => void
  setBoundary: (isBoundary: boolean, direction?: 'input' | 'output') => void
  setBoundaryDirection: (direction: 'input' | 'output') => void
  remove: () => void
}

export function useContactState(contactId: string | null | undefined): UseContactStateReturn {
  const { state, updateContact, removeContact } = useNetworkState()
  
  const contact = contactId ? state.contacts[contactId] || null : null
  
  const setContent = useCallback((content: any) => {
    if (!contactId) return
    updateContact(contactId, { content })
  }, [contactId, updateContact])
  
  const setBlendMode = useCallback((blendMode: 'accept-last' | 'merge') => {
    if (!contactId) return
    updateContact(contactId, { blendMode })
  }, [contactId, updateContact])
  
  const setPosition = useCallback((position: { x: number; y: number }) => {
    if (!contactId) return
    updateContact(contactId, { position })
  }, [contactId, updateContact])
  
  const setName = useCallback((name: string | undefined) => {
    if (!contactId) return
    updateContact(contactId, { name })
  }, [contactId, updateContact])
  
  const setBoundary = useCallback((isBoundary: boolean, direction: 'input' | 'output' = 'input') => {
    if (!contactId) return
    updateContact(contactId, { 
      isBoundary, 
      boundaryDirection: isBoundary ? direction : undefined 
    })
  }, [contactId, updateContact])
  
  const setBoundaryDirection = useCallback((direction: 'input' | 'output') => {
    if (!contactId || !contact?.isBoundary) return
    updateContact(contactId, { boundaryDirection: direction })
  }, [contactId, contact?.isBoundary, updateContact])
  
  const remove = useCallback(() => {
    if (!contactId) return
    removeContact(contactId)
  }, [contactId, removeContact])
  
  return {
    contact,
    content: contact?.content,
    blendMode: contact?.blendMode ?? 'accept-last',
    isBoundary: contact?.isBoundary ?? false,
    boundaryDirection: contact?.boundaryDirection,
    isContradicted: !!contact?.lastContradiction,
    lastContradiction: contact?.lastContradiction ?? null,
    position: contact?.position ?? { x: 0, y: 0 },
    name: contact?.name,
    
    setContent,
    setBlendMode,
    setPosition,
    setName,
    setBoundary,
    setBoundaryDirection,
    remove
  }
}