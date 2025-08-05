import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useSound } from '~/components/SoundSystem'

export interface URLState {
  // Core parameters that should always be preserved
  bassline?: string
  data?: string  // For uploaded basslines
  name?: string  // For uploaded bassline names
  
  // Navigation state
  groupId?: string  // Current group/gadget we're viewing
  path?: string     // Full navigation path (e.g., "root/gadget1/gadget2")
  
  // Mode/tool state
  mode?: 'normal' | 'property' | 'valence'
  nodeId?: string
  selection?: string  // JSON array of selected node IDs
  focus?: string
  
  // Tool state
  tool?: string  // Active tool name
  
  // Any other dynamic parameters
  [key: string]: string | undefined
}

interface UseURLStateReturn {
  urlState: URLState
  
  // Navigation helpers
  pushState: (updates: Partial<URLState>) => void
  popState: (keys: string[]) => void
  replaceState: (state: URLState) => void
  clearMode: () => void
  
  // State getters
  getMode: () => string
  getSelection: () => string[] | null
  getBassline: () => string | undefined
  
  // URL builders
  buildURL: (updates: Partial<URLState>) => string
}

/**
 * Hook for managing URL-based state in the editor
 * Handles preservation of core parameters and mode transitions
 */
export function useURLState(): UseURLStateReturn {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Parse current URL state
  const urlState = useMemo(() => {
    const state: URLState = {}
    
    // Extract all parameters
    searchParams.forEach((value, key) => {
      state[key] = value
    })
    
    return state
  }, [searchParams])
  
  // Build URL from state object
  const buildURL = useCallback((updates: Partial<URLState>) => {
    const newState = { ...urlState, ...updates }
    const params = new URLSearchParams()
    
    // Add all non-undefined values
    Object.entries(newState).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, value)
      }
    })
    
    const search = params.toString()
    return search ? `?${search}` : ''
  }, [urlState])
  
  // Push new state (merge with existing)
  const pushState = useCallback((updates: Partial<URLState>) => {
    setSearchParams((currentParams) => {
      // Create a new URLSearchParams to avoid mutating the current one
      const newParams = new URLSearchParams(currentParams)
      
      // Apply updates
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          newParams.delete(key)
        } else {
          newParams.set(key, value)
        }
      })
      
      return newParams
    }, { replace: true })
  }, [setSearchParams])
  
  // Remove specific keys from state
  const popState = useCallback((keys: string[]) => {
    setSearchParams((currentParams) => {
      const newParams = new URLSearchParams(currentParams)
      
      // Remove specified keys
      keys.forEach(key => {
        newParams.delete(key)
      })
      
      return newParams
    }, { replace: true })
  }, [setSearchParams])
  
  // Replace entire state
  const replaceState = useCallback((state: URLState) => {
    const params = new URLSearchParams()
    Object.entries(state).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, value)
      }
    })
    
    setSearchParams(params, { replace: true })
  }, [setSearchParams])
  
  // Clear mode-related parameters
  const clearMode = useCallback(() => {
    popState(['mode', 'nodeId', 'selection', 'focus'])
  }, [popState])
  
  // Getters
  const getMode = useCallback(() => {
    return urlState.mode || 'normal'
  }, [urlState])
  
  const getSelection = useCallback(() => {
    if (!urlState.selection) return null
    try {
      return JSON.parse(decodeURIComponent(urlState.selection))
    } catch {
      return null
    }
  }, [urlState])
  
  const getBassline = useCallback(() => {
    return urlState.bassline
  }, [urlState])
  
  return {
    urlState,
    pushState,
    popState,
    replaceState,
    clearMode,
    getMode,
    getSelection,
    getBassline,
    buildURL
  }
}

/**
 * Hook for managing mode transitions with proper URL state
 */
export function useEditorModes() {
  const { urlState, pushState, clearMode } = useURLState()
  const { play: playToolEnableSound } = useSound('ui/tool-enable')
  const { play: playToolDisableSound } = useSound('ui/tool-disable')
  
  const enterPropertyMode = useCallback((nodeId: string, focus = false) => {
    playToolEnableSound()
    pushState({
      mode: 'property',
      nodeId,
      focus: focus ? 'true' : undefined
    })
  }, [pushState, playToolEnableSound])
  
  const enterValenceMode = useCallback((selection: string[]) => {
    pushState({
      mode: 'valence',
      selection: JSON.stringify(selection)
    })
  }, [pushState])
  
  const exitMode = useCallback(() => {
    if (urlState.mode) {
      playToolDisableSound()
    }
    clearMode()
  }, [clearMode, urlState.mode, playToolDisableSound])
  
  const toggleMode = useCallback((mode: 'property' | 'valence', data?: any) => {
    if (urlState.mode === mode) {
      exitMode()
    } else {
      switch (mode) {
        case 'property':
          if (data?.nodeId) {
            enterPropertyMode(data.nodeId, data.focus)
          }
          break
        case 'valence':
          if (data?.selection) {
            enterValenceMode(data.selection)
          }
          break
      }
    }
  }, [urlState.mode, exitMode, enterPropertyMode, enterValenceMode])
  
  return {
    currentMode: urlState.mode || 'normal',
    enterPropertyMode,
    enterValenceMode,
    exitMode,
    toggleMode
  }
}

/**
 * Hook for managing navigation state in URL
 */
export function useNavigationState() {
  const { urlState, pushState } = useURLState()
  
  const navigateToGroup = useCallback((groupId: string, path?: string) => {
    pushState({
      groupId,
      path: path || groupId
    })
  }, [pushState])
  
  const navigateToParent = useCallback(() => {
    if (!urlState.path) return
    
    const pathParts = urlState.path.split('/')
    if (pathParts.length <= 1) {
      // At root, clear navigation
      pushState({
        groupId: undefined,
        path: undefined
      })
    } else {
      // Go up one level
      pathParts.pop()
      const parentPath = pathParts.join('/')
      const parentId = pathParts[pathParts.length - 1] || 'root'
      pushState({
        groupId: parentId === 'root' ? undefined : parentId,
        path: parentPath === 'root' ? undefined : parentPath
      })
    }
  }, [urlState.path, pushState])
  
  const getCurrentGroupId = useCallback(() => {
    return urlState.groupId
  }, [urlState.groupId])
  
  const getNavigationPath = useCallback(() => {
    return urlState.path?.split('/') || []
  }, [urlState.path])
  
  return {
    currentGroupId: urlState.groupId,
    navigationPath: getNavigationPath(),
    navigateToGroup,
    navigateToParent
  }
}

/**
 * Hook for managing selection state in URL
 */
export function useSelectionState() {
  const { urlState, pushState } = useURLState()
  
  const setSelection = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) {
      pushState({ selection: undefined })
    } else {
      pushState({
        selection: JSON.stringify(nodeIds)
      })
    }
  }, [pushState])
  
  const addToSelection = useCallback((nodeId: string) => {
    const current = getSelection()
    const newSelection = current ? [...current, nodeId] : [nodeId]
    setSelection([...new Set(newSelection)]) // Remove duplicates
  }, [urlState.selection])
  
  const removeFromSelection = useCallback((nodeId: string) => {
    const current = getSelection()
    if (!current) return
    setSelection(current.filter(id => id !== nodeId))
  }, [urlState.selection])
  
  const clearSelection = useCallback(() => {
    pushState({ selection: undefined })
  }, [pushState])
  
  const getSelection = useCallback((): string[] => {
    if (!urlState.selection) return []
    try {
      return JSON.parse(decodeURIComponent(urlState.selection))
    } catch {
      return []
    }
  }, [urlState.selection])
  
  return {
    selection: getSelection(),
    setSelection,
    addToSelection,
    removeFromSelection,
    clearSelection
  }
}