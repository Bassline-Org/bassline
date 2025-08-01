import { useState, useEffect } from 'react'
import type { ViewSettings } from '~/components/ToolsMenu'

const STORAGE_KEY = 'bassline-view-settings'

const defaultSettings: ViewSettings = {
  showInstructions: true,
  showMiniMap: true,
  showGrid: true,
  showPropagationFlow: false,
  showNodeLabels: true,
  showDebugInfo: false,
  showShortcutHints: true
}

export function useViewSettings() {
  // Always start with default state to avoid hydration mismatch
  const [viewSettings, setViewSettings] = useState<ViewSettings>(defaultSettings)
  
  // Load from localStorage after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setViewSettings({ ...defaultSettings, ...parsed })
        }
      } catch (e) {
        console.error('Failed to load view settings:', e)
      }
    }
  }, [])
  
  // Save to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(viewSettings))
      } catch (e) {
        console.error('Failed to save view settings:', e)
      }
    }
  }, [viewSettings])
  
  return {
    viewSettings,
    setViewSettings
  }
}