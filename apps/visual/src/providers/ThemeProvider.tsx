import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Theme, TokenDefinition } from '../types'

interface ThemeContextValue {
  // Current theme
  theme: Theme | null
  colors: Record<string, string>
  typography: Record<string, string>

  // Available themes
  themes: Theme[]

  // Token metadata (for theme editor)
  tokens: TokenDefinition[]

  // Loading state
  isLoading: boolean

  // Actions
  setTheme: (id: string) => Promise<void>
  updateColor: (tokenId: string, value: string) => Promise<void>
  updateTypography: (tokenId: string, value: string) => Promise<void>
  createTheme: (name: string, basedOn?: string) => Promise<Theme | null>
  deleteTheme: (id: string) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Map our tokens to Tailwind v4 theme variables (--theme-* prefix)
// These are referenced by @theme inline in CSS
function applyTailwindColors(colors: Record<string, string>) {
  const root = document.documentElement
  const mappings: Record<string, string> = {
    'theme-background': colors['bg-base'],
    'theme-foreground': colors['fg-base'],
    'theme-card': colors['bg-surface'],
    'theme-card-foreground': colors['fg-base'],
    'theme-popover': colors['bg-overlay'],
    'theme-popover-foreground': colors['fg-base'],
    'theme-primary': colors['accent'],
    'theme-primary-foreground': colors['accent-fg'],
    'theme-secondary': colors['bg-muted'],
    'theme-secondary-foreground': colors['fg-base'],
    'theme-muted': colors['bg-muted'],
    'theme-muted-foreground': colors['fg-muted'],
    'theme-accent': colors['accent-muted'],
    'theme-accent-foreground': colors['fg-base'],
    'theme-destructive': colors['error'],
    'theme-destructive-foreground': colors['error-fg'],
    'theme-border': colors['border-base'],
    'theme-input': colors['border-base'],
    'theme-ring': colors['border-focus'],
  }

  for (const [tailwindVar, value] of Object.entries(mappings)) {
    if (value) {
      root.style.setProperty(`--${tailwindVar}`, value)
    }
  }
}

// Apply our color tokens to CSS custom properties
function applyColors(colors: Record<string, string>) {
  const root = document.documentElement
  for (const [token, value] of Object.entries(colors)) {
    root.style.setProperty(`--color-${token}`, value)
  }
  // Also set Tailwind v4 color variables
  applyTailwindColors(colors)
}

// Apply typography tokens to CSS custom properties
function applyTypography(typography: Record<string, string>) {
  const root = document.documentElement
  for (const [token, value] of Object.entries(typography)) {
    // font-size-base gets 'px' appended
    if (token === 'font-size-base') {
      root.style.setProperty(`--${token}`, `${value}px`)
    } else {
      root.style.setProperty(`--${token}`, value)
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null)
  const [colors, setColors] = useState<Record<string, string>>({})
  const [typography, setTypography] = useState<Record<string, string>>({})
  const [themes, setThemes] = useState<Theme[]>([])
  const [tokens, setTokens] = useState<TokenDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load initial theme
  useEffect(() => {
    async function init() {
      try {
        const [activeId, allThemes, allTokens] = await Promise.all([
          window.db.settings.get('active_theme'),
          window.db.themes.list(),
          window.db.themes.getTokens(),
        ])

        setThemes(allThemes)
        setTokens(allTokens)

        const themeId = activeId || 'dark'
        const themeData = await window.db.themes.get(themeId)

        if (themeData) {
          setThemeState(themeData)
          setColors(themeData.colors)
          setTypography(themeData.typography || {})
          applyColors(themeData.colors)
          if (themeData.typography) {
            applyTypography(themeData.typography)
          }
        }
      } catch (error) {
        console.error('Failed to load theme:', error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const setTheme = useCallback(async (id: string) => {
    try {
      const themeData = await window.db.themes.get(id)
      if (themeData) {
        await window.db.settings.set('active_theme', id)
        setThemeState(themeData)
        setColors(themeData.colors)
        setTypography(themeData.typography || {})
        applyColors(themeData.colors)
        if (themeData.typography) {
          applyTypography(themeData.typography)
        }
      }
    } catch (error) {
      console.error('Failed to set theme:', error)
    }
  }, [])

  const updateColor = useCallback(
    async (tokenId: string, value: string) => {
      if (!theme) return

      // Optimistic update - update state and apply all CSS variables
      const newColors = { ...colors, [tokenId]: value }
      setColors(newColors)
      applyColors(newColors) // This updates both --color-* and --theme-* vars

      try {
        await window.db.themes.updateColor(theme.id, tokenId, value)
      } catch (error) {
        console.error('Failed to update color:', error)
        // Revert on error
        const originalTheme = await window.db.themes.get(theme.id)
        if (originalTheme) {
          setColors(originalTheme.colors)
          applyColors(originalTheme.colors)
        }
      }
    },
    [theme, colors]
  )

  const updateTypography = useCallback(
    async (tokenId: string, value: string) => {
      if (!theme) return

      // Optimistic update
      setTypography((t) => ({ ...t, [tokenId]: value }))
      if (tokenId === 'font-size-base') {
        document.documentElement.style.setProperty(`--${tokenId}`, `${value}px`)
      } else {
        document.documentElement.style.setProperty(`--${tokenId}`, value)
      }

      try {
        // Typography values use the same updateColor mechanism in the db
        await window.db.themes.updateColor(theme.id, tokenId, value)
      } catch (error) {
        console.error('Failed to update typography:', error)
        // Revert on error
        const originalTheme = await window.db.themes.get(theme.id)
        if (originalTheme?.typography) {
          setTypography(originalTheme.typography)
          applyTypography(originalTheme.typography)
        }
      }
    },
    [theme]
  )

  const createTheme = useCallback(async (name: string, basedOn?: string) => {
    try {
      const newTheme = await window.db.themes.create(name, basedOn)
      if (newTheme) {
        setThemes((t) => [...t, newTheme])
      }
      return newTheme
    } catch (error) {
      console.error('Failed to create theme:', error)
      return null
    }
  }, [])

  const deleteTheme = useCallback(async (id: string) => {
    try {
      await window.db.themes.delete(id)
      setThemes((t) => t.filter((th) => th.id !== id))
    } catch (error) {
      console.error('Failed to delete theme:', error)
    }
  }, [])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors,
        typography,
        themes,
        tokens,
        isLoading,
        setTheme,
        updateColor,
        updateTypography,
        createTheme,
        deleteTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
