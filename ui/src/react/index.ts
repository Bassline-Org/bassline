// Context and provider
export * from './context'

// Hooks
export * from './hooks'

// State atoms - export selectively to avoid InspectorPane collision
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
} from './atoms'

// Portal system
export * from './portal'

// View components
export * from './views'

// Inspector components
export { InspectorPane, type InspectorPaneProps } from './inspector/InspectorPane'
export { InspectorPager, type InspectorPagerProps } from './inspector/InspectorPager'
export { ActionBar, type ActionBarProps } from './inspector/ActionBar'
