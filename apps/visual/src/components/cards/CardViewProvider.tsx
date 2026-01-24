/**
 * CardViewProvider - Context for card display configuration
 *
 * Provides view settings (display mode, density, etc.) to all card components.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { CardViewConfig, CardDisplayMode, CardDensity } from '@/types'
import type { CardBoxVariant } from './CardBox'

interface CardViewContextValue {
  config: CardViewConfig
  setDisplayMode: (mode: CardDisplayMode) => void
  setSetDisplayMode: (mode: CardDisplayMode) => void
  setDensity: (density: CardDensity) => void
  setBoxVariant: (variant: CardBoxVariant) => void
  setParallax: (enabled: boolean) => void
}

const defaultConfig: CardViewConfig = {
  defaultDisplayMode: 'art',
  defaultSetDisplayMode: 'art',
  boxVariant: 'glass',
  parallax: true,
  density: 'default',
}

const CardViewContext = createContext<CardViewContextValue | null>(null)

export interface CardViewProviderProps {
  children: ReactNode
  initialConfig?: Partial<CardViewConfig>
}

export function CardViewProvider({ children, initialConfig }: CardViewProviderProps) {
  const [config, setConfig] = useState<CardViewConfig>({
    ...defaultConfig,
    ...initialConfig,
  })

  const setDisplayMode = useCallback((mode: CardDisplayMode) => {
    setConfig((prev) => ({ ...prev, defaultDisplayMode: mode }))
  }, [])

  const setSetDisplayMode = useCallback((mode: CardDisplayMode) => {
    setConfig((prev) => ({ ...prev, defaultSetDisplayMode: mode }))
  }, [])

  const setDensity = useCallback((density: CardDensity) => {
    setConfig((prev) => ({ ...prev, density }))
  }, [])

  const setBoxVariant = useCallback((boxVariant: CardBoxVariant) => {
    setConfig((prev) => ({ ...prev, boxVariant }))
  }, [])

  const setParallax = useCallback((parallax: boolean) => {
    setConfig((prev) => ({ ...prev, parallax }))
  }, [])

  return (
    <CardViewContext.Provider
      value={{
        config,
        setDisplayMode,
        setSetDisplayMode,
        setDensity,
        setBoxVariant,
        setParallax,
      }}
    >
      {children}
    </CardViewContext.Provider>
  )
}

export function useCardView(): CardViewContextValue {
  const context = useContext(CardViewContext)
  if (!context) {
    throw new Error('useCardView must be used within a CardViewProvider')
  }
  return context
}

/**
 * Optional hook that returns default values if outside provider
 */
export function useCardViewOptional(): CardViewContextValue {
  const context = useContext(CardViewContext)
  if (!context) {
    // Return a no-op version with defaults
    return {
      config: defaultConfig,
      setDisplayMode: () => {},
      setSetDisplayMode: () => {},
      setDensity: () => {},
      setBoxVariant: () => {},
      setParallax: () => {},
    }
  }
  return context
}

export default CardViewProvider
