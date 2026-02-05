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
import type { View, Action, Tool } from '../core/types'
import { useInspectorContext } from './context'
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
} from './atoms'

// ============================================================================
// Main Inspector Hook
// ============================================================================

export interface UseInspectorReturn {
  /** All panes in the chain */
  panes: InspectorPane[]
  /** Number of panes */
  paneCount: number
  /** Currently focused pane (for keyboard nav) */
  focusedPane: InspectorPane | null
  /** Index of focused pane */
  focusedPaneIndex: number
  /** Current (rightmost) pane */
  currentPane: InspectorPane | null

  /** Inspect a new object (appends to chain) */
  inspect: (target: Viewable<unknown>, breadcrumbLabel?: string) => void
  /** Start fresh with a new root object */
  inspectRoot: (target: Viewable<unknown>) => void
  /** Close current (rightmost) pane */
  closeCurrent: () => void
  /** Close all panes */
  clear: () => void
  /** Navigate focus left */
  goBack: () => void
  /** Navigate focus right */
  goForward: () => void
}

/**
 * Main hook for inspector navigation.
 * Provides access to the inspection chain and navigation actions.
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
  /** Select a view by index */
  selectView: (viewIndex: number) => void
  /** Close this pane (and all downstream) */
  close: () => void
  /** Focus this pane */
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
 * Returns a function that inspects a target and tracks the source pane.
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
// Prototype Chain Collection
// ============================================================================

/**
 * Collect producer functions from an object's prototype chain.
 * Stops when:
 * - An object opts out of inheritance (via the shouldInherit check)
 * - We reach Object.prototype or null
 *
 * @param target - The object to start from
 * @param symbol - The symbol key to collect (e.g., phlowViews)
 * @param shouldInherit - Function to check if inheritance should continue
 * @returns Array of collected producer functions
 */
function collectFromPrototypeChain<T>(target: object, symbol: symbol, shouldInherit: (obj: unknown) => boolean): T[] {
  const allProducers: T[] = []
  let current: object | null = target

  while (current !== null) {
    // Stop if this object opts out of inheritance (except for the target itself)
    if (current !== target && !shouldInherit(current)) {
      break
    }

    // Collect from this level if it has the symbol
    if (symbol in current) {
      const producers = (current as any)[symbol]
      if (Array.isArray(producers)) {
        allProducers.push(...producers)
      }
    }

    // Move to prototype
    current = Object.getPrototypeOf(current)

    // Stop at Object.prototype or null
    if (current === Object.prototype || current === null) {
      break
    }
  }

  return allProducers
}

// ============================================================================
// View Collection Hook
// ============================================================================

/**
 * Hook that extracts and sorts views from a Viewable target.
 * Collects views from the object and its prototype chain.
 * Calls each view producer function to get the actual views.
 */
export function useViews<T>(target: Viewable<T> | null): View<T>[] {
  return useMemo(() => {
    if (!target) {
      return []
    }

    // Collect view producers from prototype chain
    const allProducers = collectFromPrototypeChain<ViewProducer<T>>(target, phlowViews, shouldInheritViews)

    // Call producers and filter/sort results
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
 * Collects actions from the object and its prototype chain.
 * Calls each action producer function to get the actual actions.
 */
export function useActions(target: object | null): Action[] {
  return useMemo(() => {
    if (!target) {
      return []
    }

    // Collect action producers from prototype chain
    const allProducers = collectFromPrototypeChain<ActionProducer>(target, phlowActions, shouldInheritActions)

    // Call producers and filter results
    const actions = allProducers
      .map(producer => producer())
      .filter(a => a.phlow !== 'emptyAction')
      .sort((a, b) => {
        const aPriority = 'priority' in a ? (a.priority ?? 50) : 50
        const bPriority = 'priority' in b ? (b.priority ?? 50) : 50
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
 * Collects tools from the object and its prototype chain.
 * Calls each tool producer function to get the actual tools.
 */
export function useTools<T>(target: Viewable<T> | null): Tool<T>[] {
  return useMemo(() => {
    if (!target) {
      return []
    }

    // Collect tool producers from prototype chain
    const allProducers = collectFromPrototypeChain<ToolProducer<T>>(target, phlowTools, shouldInheritTools)

    // Call producers and filter/sort results
    const tools = allProducers
      .map(producer => producer())
      .filter(t => t.phlow !== 'emptyTool')
      .sort((a, b) => {
        const aPriority = 'priority' in a ? (a.priority ?? 50) : 50
        const bPriority = 'priority' in b ? (b.priority ?? 50) : 50
        return aPriority - bPriority
      })

    return tools as Tool<T>[]
  }, [target])
}

// ============================================================================
// Extension Hook
// ============================================================================

/**
 * Hook for registering an extension to an inspector slot.
 * Returns a function to register the extension; call the returned cleanup to unregister.
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
 * Automatically registers on mount and cleans up on unmount.
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
