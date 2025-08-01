import { useState, useCallback, useEffect } from 'react'
import type { GadgetTemplate } from '../../propagation-core/types/template'
import { createPrimitiveTemplates } from '../../propagation-core/primitives-registry'

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

// Create default palette items from primitive templates
function createDefaultPaletteItems(): PaletteItem[] {
  const primitiveTemplates = createPrimitiveTemplates()
  console.log('Creating default palette items, primitive templates:', primitiveTemplates)
  return primitiveTemplates.map(template => ({
    ...template,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    usageCount: 0
  }))
}

export function usePalette() {
  // Always start with default state to avoid hydration mismatch
  const [state, setState] = useState<PaletteState>({
    items: [],
    categories: ['Math', 'Logic', 'Data', 'Utility'],
    isVisible: false // Start hidden to avoid flash
  })
  
  // Load from localStorage after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          
          // Check if we need to add primitive gadgets to existing palette
          const hasPrimitives = parsed.items.some((item: PaletteItem) => 
            ['Adder', 'Subtractor', 'Multiplier', 'Divider'].includes(item.name)
          )
          
          if (!hasPrimitives) {
            console.log('Adding primitive gadgets to existing palette')
            const primitiveItems = createDefaultPaletteItems()
            parsed.items = [...primitiveItems, ...parsed.items]
          }
          
          setState(parsed)
        } else {
          // First time - load default primitive gadgets
          console.log('No stored palette found, loading defaults')
          const defaultItems = createDefaultPaletteItems()
          setState({
            items: defaultItems,
            categories: ['Math', 'Logic', 'Data', 'Utility'],
            isVisible: true // Show palette by default when first loaded
          })
        }
      } catch (e) {
        console.error('Failed to load palette from storage:', e)
        // On error, load defaults
        const defaultItems = createDefaultPaletteItems()
        setState({
          items: defaultItems,
          categories: ['Math', 'Logic', 'Data', 'Utility'],
          isVisible: true
        })
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
  
  const resetToDefaults = useCallback(() => {
    const defaultItems = createDefaultPaletteItems()
    setState({
      items: defaultItems,
      categories: ['Math', 'Logic', 'Data', 'Utility'],
      isVisible: true
    })
  }, [])

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
    getRecent,
    resetToDefaults
  }
}