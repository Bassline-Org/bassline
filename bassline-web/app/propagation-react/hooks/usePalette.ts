import { useState, useCallback, useEffect } from 'react'
import type { GadgetTemplate } from '../../propagation-core/types/template'

interface PaletteItem extends GadgetTemplate {
  id: string
  createdAt: number
  usageCount: number
}

interface PaletteState {
  items: PaletteItem[]
  categories: string[]
  isVisible: boolean
}

const STORAGE_KEY = 'bassline-gadget-palette'

export function usePalette() {
  // Always start with default state to avoid hydration mismatch
  const [state, setState] = useState<PaletteState>({
    items: [],
    categories: ['Math', 'Logic', 'Data', 'Utility'],
    isVisible: true
  })
  
  // Load from localStorage after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setState(parsed)
        }
      } catch (e) {
        console.error('Failed to load palette from storage:', e)
      }
    }
  }, [])
  
  // Save to localStorage whenever state changes (only on client)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (e) {
        console.error('Failed to save palette to storage:', e)
      }
    }
  }, [state])
  
  const addToPalette = useCallback((template: GadgetTemplate) => {
    setState(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...template,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          usageCount: 0
        }
      ]
    }))
  }, [])
  
  const removeFromPalette = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }, [])
  
  const updatePaletteItem = useCallback((itemId: string, updates: Partial<PaletteItem>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      )
    }))
  }, [])
  
  const incrementUsageCount = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId 
          ? { ...item, usageCount: item.usageCount + 1 } 
          : item
      )
    }))
  }, [])
  
  const toggleVisibility = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: !prev.isVisible }))
  }, [])
  
  const getItemsByCategory = useCallback((category?: string) => {
    if (!category) return state.items
    return state.items.filter(item => item.category === category)
  }, [state.items])
  
  const getMostUsed = useCallback((limit = 5) => {
    return [...state.items]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
  }, [state.items])
  
  const getRecent = useCallback((limit = 5) => {
    return [...state.items]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }, [state.items])
  
  return {
    items: state.items,
    categories: state.categories,
    isVisible: state.isVisible,
    addToPalette,
    removeFromPalette,
    updatePaletteItem,
    incrementUsageCount,
    toggleVisibility,
    getItemsByCategory,
    getMostUsed,
    getRecent
  }
}