import { useCallback, useMemo, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  phlowViews,
  phlowActions,
  phlowTools,
  isViewable,
  shouldInheritViews,
  shouldInheritActions,
  shouldInheritTools,
  type Viewable,
  type ViewProducer,
  type ActionProducer,
  type ToolProducer,
} from '../core/phlow'
import type { View, ButtonAction, WindowTool } from '../core/types'
import { collectFromPrototypeChain } from '../core/collectors'
import { useInspectorContext } from '../react/context'
import { tools as toolsRegistry } from '../tools'
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
      if (!isViewable(target)) {
        return
      }

      const sourceIndex = chainState.panes.findIndex(p => p.id === sourcePaneId)
      _inspect({
        target,
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
 * Filters out empty views.
 */
export function useViews<T>(target: Viewable<T> | null): View<T>[] {
  return useMemo(() => {
    if (!target) return []

    const allProducers = collectFromPrototypeChain<ViewProducer<T>>(target, phlowViews, shouldInheritViews)

    const views = allProducers
      .map(producer => producer())
      .filter(v => v.phlow !== 'empty')
      .sort((a, b) => {
        const aPriority = 'priority' in a ? a.priority : 100
        const bPriority = 'priority' in b ? b.priority : 100
        return aPriority - bPriority
      })

    return views as View<T>[]
  }, [target])
}

// ============================================================================
// Action Collection Hook
// ============================================================================

/**
 * Hook that extracts and sorts actions from an object.
 * Filters out empty actions and returns only ButtonActions.
 */
export function useActions(target: object | null): ButtonAction[] {
  return useMemo(() => {
    if (!target) return []

    const allProducers = collectFromPrototypeChain<ActionProducer>(target, phlowActions, shouldInheritActions)

    const actions = allProducers
      .map(producer => producer())
      .filter((a): a is ButtonAction => a.phlow === 'buttonAction')
      .sort((a, b) => {
        const aPriority = a.priority ?? 50
        const bPriority = b.priority ?? 50
        return aPriority - bPriority
      })

    return actions
  }, [target])
}

// ============================================================================
// Tool Collection Hook
// ============================================================================

/**
 * Hook that extracts and sorts tools from an object.
 * Always includes the Inspector tool as the first tool.
 * Filters out empty tools and returns only WindowTools.
 */
export function useTools<T>(target: Viewable<T> | null): WindowTool<T>[] {
  return useMemo(() => {
    if (!target) return []

    // Always include inspector as the first tool
    const allTools: WindowTool<T>[] = [toolsRegistry.inspector<T>()]

    // Collect custom tools from prototype chain
    const producers = collectFromPrototypeChain<ToolProducer<T>>(target, phlowTools, shouldInheritTools)

    for (const producer of producers) {
      const tool = producer()
      // Filter out empty tools - only include WindowTools
      if (tool.phlow === 'windowTool') {
        allTools.push(tool)
      }
    }

    return allTools.sort((a, b) => {
      const aPriority = a.priority ?? 50
      const bPriority = b.priority ?? 50
      return aPriority - bPriority
    })
  }, [target])
}

// ============================================================================
// Extension Hooks
// ============================================================================

/**
 * Hook for registering an extension to an inspector slot.
 */
export function useInspectorExtension(
  paneId: string,
  slot: 'bar' | 'actions' | 'search' | 'footer',
  priority: number = 50
) {
  const { registerExtension } = useInspectorContext()

  return useCallback(
    (render: () => React.ReactNode) => {
      return registerExtension({
        paneId,
        slot,
        priority,
        render,
      })
    },
    [registerExtension, paneId, slot, priority]
  )
}

/**
 * Effect-based extension registration.
 */
export function useExtension(
  paneId: string,
  slot: 'bar' | 'actions' | 'search' | 'footer',
  render: () => React.ReactNode,
  deps: React.DependencyList = [],
  priority: number = 50
) {
  const register = useInspectorExtension(paneId, slot, priority)

  useEffect(() => {
    return register(render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, ...deps])
}
