import { useState, useEffect } from 'react'
import type { AppSettings } from '~/propagation-core/types'
import { defaultAppSettings } from '~/propagation-core/types'

const STORAGE_KEY = 'bassline-app-settings'

export function useAppSettings() {
  // Always start with default state to avoid hydration mismatch
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings)

  // Load from localStorage after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as AppSettings
          // Deep merge with defaults to handle new settings added in updates
          setAppSettings({
            propagation: { ...defaultAppSettings.propagation, ...parsed.propagation },
            visual: { ...defaultAppSettings.visual, ...parsed.visual },
            behavior: { ...defaultAppSettings.behavior, ...parsed.behavior }
          })
        }
      } catch (e) {
        console.error('Failed to load app settings:', e)
      }
    }
  }, [])

  // Save to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings))
      } catch (e) {
        console.error('Failed to save app settings:', e)
      }
    }
  }, [appSettings])

  // Helper functions for updating specific categories
  const updatePropagationSettings = (updates: Partial<AppSettings['propagation']>) => {
    setAppSettings(prev => ({
      ...prev,
      propagation: { ...prev.propagation, ...updates }
    }))
  }

  const updateVisualSettings = (updates: Partial<AppSettings['visual']>) => {
    setAppSettings(prev => ({
      ...prev,
      visual: { ...prev.visual, ...updates }
    }))
  }

  const updateBehaviorSettings = (updates: Partial<AppSettings['behavior']>) => {
    setAppSettings(prev => ({
      ...prev,
      behavior: { ...prev.behavior, ...updates }
    }))
  }

  const resetToDefaults = () => {
    setAppSettings(defaultAppSettings)
  }

  return {
    appSettings,
    setAppSettings,
    updatePropagationSettings,
    updateVisualSettings,
    updateBehaviorSettings,
    resetToDefaults
  }
}