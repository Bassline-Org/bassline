/**
 * Views registry - factory functions for creating view definitions.
 *
 * Views are plain data objects that describe how to visualize something.
 * They're rendered by the ViewRenderer component, which switches on view.phlow.
 */

// Re-export phlow factory as views for API consistency
// phlow is the canonical factory in core/phlow.ts
import { phlow, PRIORITY } from '../core/phlow'

export { PRIORITY }

/**
 * Factory functions for creating view definitions.
 * Each method returns a view object with sensible defaults.
 *
 * @example
 * import { views } from '@bassline/ui'
 *
 * class MyClass {
 *   [phlowViews] = [
 *     () => views.info({
 *       title: 'Details',
 *       entries: {
 *         name: () => ({ text: this.name }),
 *         count: () => ({ text: String(this.count) }),
 *       }
 *     }),
 *     () => views.list({
 *       title: 'Items',
 *       items: () => this.items,
 *       text: item => item.name,
 *       send: item => item,
 *     })
 *   ]
 * }
 */
export const views = phlow

// Re-export view components
export { ViewRenderer, PhlowView, type ViewRendererProps, type PhlowViewProps } from '../react/views/ViewRenderer'
export { ListView, type ListViewProps } from '../react/views/ListView'
export { ColumnedListView, type ColumnedListViewProps } from '../react/views/ColumnedListView'
export { InfoView, type InfoViewProps } from '../react/views/InfoView'
export { TextView, type TextViewProps } from '../react/views/TextView'
export { ForwardView, type ForwardViewProps } from '../react/views/ForwardView'
export { ExplicitView, type ExplicitViewProps } from '../react/views/ExplicitView'
export { DescriptorView, type DescriptorViewProps } from '../react/views/DescriptorView'
