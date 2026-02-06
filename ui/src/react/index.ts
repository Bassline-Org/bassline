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
  toggleMaximizeAtom,
  maximizedPaneIdAtom,
  generatePaneId,
  type InspectorPane as InspectorPaneState,
  type InspectorChainState,
  type InspectPayload,
} from '../state/atoms'

// View components
export * from './views'

// Pane components
export { Pane, PaneContainer, type PaneProps, type PaneContainerProps } from '../panes'

// ActionBar
export { ActionBar, type ActionBarProps } from '../panes'
