import { useCallback, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { isViewable, type Viewable } from '../core/phlow'
import type { PhlowView, PhlowButtonAction, PhlowSearchSource } from '../core/views'
import { ViewContainer, ActionContainer, SearchContainer } from '../core/container'
import { inspect } from '../core/inspect'
import {
  inspectorChainAtom,
  currentPaneAtom,
  focusedPaneAtom,
  paneCountAtom,
  inspectAtom,
  inspectRootAtom,
  closePaneAtom,
  closePaneByIdAtom,
  selectViewAtom,
  focusPaneAtom,
  navigateFocusAtom,
  clearChainAtom,
  type InspectorPane,
} from '../state/atoms'

// ============================================================================
// Main Inspector Hook
// ============================================================================

export interface UseInspectorReturn {
  panes: InspectorPane[]
  paneCount: number
  focusedPane: InspectorPane | null
  focusedPaneIndex: number
  currentPane: InspectorPane | null
  inspect: (target: Viewable<unknown>, breadcrumbLabel?: string) => void
  inspectRoot: (target: Viewable<unknown>) => void
  closeCurrent: () => void
  clear: () => void
  goBack: () => void
  goForward: () => void
}

/**
 * Main hook for inspector navigation.
 */
export function useInspector(): UseInspectorReturn {
  const chainState = useAtomValue(inspectorChainAtom)
  const currentPane = useAtomValue(currentPaneAtom)
  const focusedPane = useAtomValue(focusedPaneAtom)
  const paneCount = useAtomValue(paneCountAtom)

  const _inspect = useSetAtom(inspectAtom)
  const _inspectRoot = useSetAtom(inspectRootAtom)
  const _closePane = useSetAtom(closePaneAtom)
  const _navigateFocus = useSetAtom(navigateFocusAtom)
  const _clear = useSetAtom(clearChainAtom)

  const inspect = useCallback(
    (target: Viewable<unknown>, breadcrumbLabel?: string) => {
      _inspect({ target, breadcrumbLabel })
    },
    [_inspect]
  )

  const inspectRoot = useCallback(
    (target: Viewable<unknown>) => {
      _inspectRoot(target)
    },
    [_inspectRoot]
  )

  const closeCurrent = useCallback(() => {
    if (chainState.panes.length > 0) {
      _closePane(chainState.panes.length - 1)
    }
  }, [_closePane, chainState.panes.length])

  const goBack = useCallback(() => {
    _navigateFocus('left')
  }, [_navigateFocus])

  const goForward = useCallback(() => {
    _navigateFocus('right')
  }, [_navigateFocus])

  return {
    panes: chainState.panes,
    paneCount,
    focusedPane,
    focusedPaneIndex: chainState.focusedPaneIndex,
    currentPane,
    inspect,
    inspectRoot,
    closeCurrent,
    clear: _clear,
    goBack,
    goForward,
  }
}

// ============================================================================
// Pane-Specific Hooks
// ============================================================================

export interface UsePaneReturn {
  pane: InspectorPane | null
  selectView: (viewIndex: number) => void
  close: () => void
  focus: () => void
}

/**
 * Hook for accessing a specific pane by ID.
 */
export function usePane(paneId: string): UsePaneReturn {
  const chainState = useAtomValue(inspectorChainAtom)
  const _selectView = useSetAtom(selectViewAtom)
  const _closePane = useSetAtom(closePaneByIdAtom)
  const _focusPane = useSetAtom(focusPaneAtom)

  const paneIndex = useMemo(() => chainState.panes.findIndex(p => p.id === paneId), [chainState.panes, paneId])
  const pane = paneIndex >= 0 ? chainState.panes[paneIndex] : null

  const selectView = useCallback(
    (viewIndex: number) => {
      if (paneIndex >= 0) {
        _selectView({ paneIndex, viewIndex })
      }
    },
    [paneIndex, _selectView]
  )

  const close = useCallback(() => {
    _closePane(paneId)
  }, [_closePane, paneId])

  const focus = useCallback(() => {
    if (paneIndex >= 0) {
      _focusPane(paneIndex)
    }
  }, [paneIndex, _focusPane])

  return { pane, selectView, close, focus }
}

/**
 * Hook for the currently focused pane.
 */
export function useActivePane(): InspectorPane | null {
  return useAtomValue(focusedPaneAtom)
}

// ============================================================================
// Inspection Trigger Hook
// ============================================================================

/**
 * Hook for triggering inspection from within a pane.
 */
export function useInspectFrom(sourcePaneId: string) {
  const chainState = useAtomValue(inspectorChainAtom)
  const _inspect = useSetAtom(inspectAtom)

  return useCallback(
    (target: unknown, breadcrumbLabel?: string) => {
      const viewable = isViewable(target) ? target : inspect(target)
      if (!viewable) return

      const sourceIndex = chainState.panes.findIndex(p => p.id === sourcePaneId)
      _inspect({
        target: viewable,
        fromPaneIndex: sourceIndex >= 0 ? sourceIndex : undefined,
        breadcrumbLabel,
      })
    },
    [_inspect, chainState.panes, sourcePaneId]
  )
}

// ============================================================================
// View Collection Hook
// ============================================================================

/**
 * Hook that extracts and sorts views from a Viewable target.
 * Uses ViewContainer.collect() to walk the prototype chain.
 */
export function useViews<T>(target: Viewable<T> | null): PhlowView<T>[] {
  return useMemo(() => {
    if (!target) return []
    return ViewContainer.collect<T>(target)
  }, [target])
}

// ============================================================================
// Action Collection Hook
// ============================================================================

/**
 * Hook that extracts and sorts actions from an object.
 */
export function useActions(target: object | null): PhlowButtonAction[] {
  return useMemo(() => {
    if (!target) return []
    return ActionContainer.collect(target)
  }, [target])
}

// ============================================================================
// Search Collection Hook
// ============================================================================

/**
 * Hook that extracts and sorts search sources from an object.
 */
export function useSearches(target: object | null): PhlowSearchSource[] {
  return useMemo(() => {
    if (!target) return []
    return SearchContainer.collect(target)
  }, [target])
}
