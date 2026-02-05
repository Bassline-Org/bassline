import { atom } from 'jotai'
import { atomWithImmer } from 'jotai-immer'
import type { Viewable } from '../core/phlow'

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single pane in the inspector chain (Miller columns).
 * Each pane inspects one object and maintains its own view selection state.
 */
export interface InspectorPane {
  /** Unique identifier for this pane */
  id: string
  /** The object being inspected */
  target: Viewable<unknown>
  /** Currently selected view tab index */
  selectedViewIndex: number
  /** Label shown in breadcrumb (how we got here) */
  breadcrumbLabel?: string
  /** Source pane info for tracking navigation */
  source?: {
    paneId: string
    itemIndex?: number
  }
  /** Currently selected tool ID ('inspector' by default) */
  selectedToolId: string
}

/**
 * Complete state of the inspector chain.
 */
export interface InspectorChainState {
  /** Ordered list of panes from root (index 0) to current (last) */
  panes: InspectorPane[]
  /** Index of the focused pane (-1 if none) */
  focusedPaneIndex: number
  /** ID of maximized pane (null if none) - only one pane can be maximized at a time */
  maximizedPaneId: string | null
}

// ============================================================================
// ID Generation
// ============================================================================

let _paneId = 0
export const generatePaneId = () => `pane-${++_paneId}`

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Initial state for the inspector chain
 */
const createInitialState = (): InspectorChainState => ({
  panes: [],
  focusedPaneIndex: -1,
  maximizedPaneId: null,
})

/**
 * Main state atom for the inspector chain.
 * Uses immer for immutable updates.
 */
export const inspectorChainAtom = atomWithImmer<InspectorChainState>(createInitialState())

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Current (rightmost) pane
 */
export const currentPaneAtom = atom(get => {
  const state = get(inspectorChainAtom)
  return state.panes.length > 0 ? state.panes[state.panes.length - 1] : null
})

/**
 * Focused pane (for keyboard navigation)
 */
export const focusedPaneAtom = atom(get => {
  const state = get(inspectorChainAtom)
  const { focusedPaneIndex, panes } = state
  return focusedPaneIndex >= 0 && focusedPaneIndex < panes.length ? panes[focusedPaneIndex] : null
})

/**
 * Total number of panes
 */
export const paneCountAtom = atom(get => get(inspectorChainAtom).panes.length)

// ============================================================================
// Action Atoms
// ============================================================================

export interface InspectPayload {
  target: Viewable<unknown>
  /** If provided, truncates panes after this index before adding */
  fromPaneIndex?: number
  /** Label for breadcrumb */
  breadcrumbLabel?: string
}

/**
 * Inspect a new object (adds to chain, optionally truncates downstream)
 */
export const inspectAtom = atom(null, (_get, set, payload: InspectPayload) => {
  const { target, fromPaneIndex, breadcrumbLabel } = payload

  set(inspectorChainAtom, draft => {
    // If inspecting from a specific pane, truncate everything after it
    if (fromPaneIndex !== undefined && fromPaneIndex < draft.panes.length) {
      draft.panes = draft.panes.slice(0, fromPaneIndex + 1)
    }

    // Create new pane
    const newPane: InspectorPane = {
      id: generatePaneId(),
      target,
      selectedViewIndex: 0,
      breadcrumbLabel,
      source: fromPaneIndex !== undefined ? { paneId: draft.panes[fromPaneIndex]?.id } : undefined,
      selectedToolId: 'inspector',
    }

    draft.panes.push(newPane)
    draft.focusedPaneIndex = draft.panes.length - 1
  })
})

/**
 * Start fresh with a new root object (clears entire chain)
 */
export const inspectRootAtom = atom(null, (_get, set, target: Viewable<unknown>) => {
  set(inspectorChainAtom, draft => {
    draft.panes = [
      {
        id: generatePaneId(),
        target,
        selectedViewIndex: 0,
        selectedToolId: 'inspector',
      },
    ]
    draft.focusedPaneIndex = 0
    draft.maximizedPaneId = null
  })
})

/**
 * Close a pane and all downstream panes
 */
export const closePaneAtom = atom(null, (_get, set, paneIndex: number) => {
  set(inspectorChainAtom, draft => {
    if (paneIndex >= 0 && paneIndex < draft.panes.length) {
      draft.panes = draft.panes.slice(0, paneIndex)
      // Adjust focus to previous pane, or -1 if empty
      draft.focusedPaneIndex = Math.min(draft.focusedPaneIndex, draft.panes.length - 1)
    }
  })
})

/**
 * Close pane by ID (and all downstream)
 */
export const closePaneByIdAtom = atom(null, (get, set, paneId: string) => {
  const state = get(inspectorChainAtom)
  const index = state.panes.findIndex(p => p.id === paneId)
  if (index >= 0) {
    set(closePaneAtom, index)
  }
})

/**
 * Change selected view within a specific pane
 */
export const selectViewAtom = atom(null, (_get, set, payload: { paneIndex: number; viewIndex: number }) => {
  const { paneIndex, viewIndex } = payload
  set(inspectorChainAtom, draft => {
    if (paneIndex >= 0 && paneIndex < draft.panes.length) {
      draft.panes[paneIndex].selectedViewIndex = viewIndex
    }
  })
})

/**
 * Set focused pane index
 */
export const focusPaneAtom = atom(null, (_get, set, paneIndex: number) => {
  set(inspectorChainAtom, draft => {
    if (paneIndex >= -1 && paneIndex < draft.panes.length) {
      draft.focusedPaneIndex = paneIndex
    }
  })
})

/**
 * Navigate focus left/right
 */
export const navigateFocusAtom = atom(null, (_get, set, direction: 'left' | 'right') => {
  set(inspectorChainAtom, draft => {
    if (direction === 'left' && draft.focusedPaneIndex > 0) {
      draft.focusedPaneIndex--
    } else if (direction === 'right' && draft.focusedPaneIndex < draft.panes.length - 1) {
      draft.focusedPaneIndex++
    }
  })
})

/**
 * Clear the entire inspector chain
 */
export const clearChainAtom = atom(null, (_get, set) => {
  set(inspectorChainAtom, createInitialState())
})

// ============================================================================
// Tool Action Atoms
// ============================================================================

/**
 * Maximized pane ID (derived atom)
 */
export const maximizedPaneIdAtom = atom(get => get(inspectorChainAtom).maximizedPaneId)

/**
 * Select a tool for a pane
 */
export const selectToolAtom = atom(null, (_get, set, payload: { paneIndex: number; toolId: string }) => {
  const { paneIndex, toolId } = payload
  set(inspectorChainAtom, draft => {
    if (paneIndex >= 0 && paneIndex < draft.panes.length) {
      draft.panes[paneIndex].selectedToolId = toolId
    }
  })
})

/**
 * Toggle maximize state for a pane
 */
export const toggleMaximizeAtom = atom(null, (_get, set, paneId: string) => {
  set(inspectorChainAtom, draft => {
    if (draft.maximizedPaneId === paneId) {
      draft.maximizedPaneId = null
    } else {
      draft.maximizedPaneId = paneId
    }
  })
})
