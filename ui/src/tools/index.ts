import type { ComponentType, ReactNode } from 'react'
import type { ToolProps, WindowTool } from '../core/types'
import { InspectorTool } from './InspectorTool'

export { InspectorTool, type InspectorToolProps } from './InspectorTool'
export { ActionBar, type ActionBarProps } from './ActionBar'

/**
 * Factory functions for creating tool definitions.
 * Tools are complete applications for interacting with objects.
 *
 * The inspector tool is always available as the default tool.
 * Custom tools can be added via the `window` factory.
 */
export const tools = {
  /**
   * Create the inspector tool (default tool for viewing objects).
   * This is automatically included by useTools - you typically don't need to call this directly.
   */
  inspector: <T>(): WindowTool<T> => ({
    phlow: 'windowTool',
    id: 'inspector',
    title: 'Inspector',
    priority: 0, // Always first
    component: InspectorTool as ComponentType<ToolProps<T>>,
  }),

  /**
   * Create a custom window tool.
   *
   * @example
   * [phlowTools] = [
   *   () => tools.window({
   *     id: 'preview',
   *     title: 'Preview',
   *     icon: '👁',
   *     component: PreviewComponent,
   *   })
   * ]
   */
  window: <T>(config: {
    id: string
    title: string
    icon?: ReactNode
    priority?: number
    component: ComponentType<ToolProps<T>>
  }): WindowTool<T> => ({
    phlow: 'windowTool',
    id: config.id,
    title: config.title,
    priority: config.priority ?? 50,
    icon: config.icon,
    component: config.component,
  }),
}
