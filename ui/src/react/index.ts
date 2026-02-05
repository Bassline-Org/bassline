// Context and provider
export * from './context'

// Hooks - re-export from new location
export * from '../hooks'

// State atoms - re-export from new location
export {
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
  selectToolAtom,
  toggleMaximizeAtom,
  maximizedPaneIdAtom,
  generatePaneId,
  type InspectorPane as InspectorPaneState,
  type InspectorChainState,
  type InspectPayload,
} from '../state/atoms'

// Portal system
export * from './portal'

// View components
export * from './views'

// Pane components (new names)
export { Pane, PaneContainer, type PaneProps, type PaneContainerProps } from '../panes'

// Inspector components (old names for backwards compatibility)
export { InspectorPane, InspectorPager, type InspectorPaneProps, type InspectorPagerProps } from '../panes'

// Tools
export { ActionBar, type ActionBarProps, InspectorTool, type InspectorToolProps, tools } from '../tools'
