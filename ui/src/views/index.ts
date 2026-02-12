/**
 * Views registry - re-exports view container factory and view components.
 */

// Re-export the container factories as the primary API
export { views, searches, PRIORITY } from '../core'

// Re-export view components
export { ViewRenderer, type ViewRendererProps } from '../react/views/ViewRenderer'
export { ListView, type ListViewProps } from '../react/views/ListView'
export { ColumnedListView, type ColumnedListViewProps } from '../react/views/ColumnedListView'
export { InfoView, type InfoViewProps } from '../react/views/InfoView'
export { TextView, type TextViewProps } from '../react/views/TextView'
export { ForwardView, type ForwardViewProps } from '../react/views/ForwardView'
export { ExplicitView, type ExplicitViewProps } from '../react/views/ExplicitView'
export { DescriptorView, type DescriptorViewProps } from '../react/views/DescriptorView'
export { MondrianView, type MondrianViewProps } from '../react/views/MondrianView'
