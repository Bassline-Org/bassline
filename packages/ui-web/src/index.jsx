/**
 * @bassline/ui-web
 *
 * React-based widget renderer for Bassline.
 *
 * This package provides:
 * - Primitive widgets (layout + atoms)
 * - WidgetRenderer for rendering hiccup definitions
 * - RootRenderer for subscribing to bl:///ui/root
 * - Registration helpers for the widget registry
 */

// Import for local use
import { registerLayoutPrimitives as _registerLayoutPrimitives } from './primitives/layout.jsx'
import { registerAtomPrimitives as _registerAtomPrimitives } from './primitives/atoms.jsx'

// Re-export primitives
export { Box, Stack, Grid, Scroll, Center, registerLayoutPrimitives } from './primitives/layout.jsx'
export {
  Text,
  Heading,
  Button,
  Input,
  Checkbox,
  Select,
  Badge,
  Spinner,
  Divider,
  registerAtomPrimitives,
  createEventDispatcher,
} from './primitives/atoms.jsx'

// Re-export renderers
export { WidgetRenderer, WidgetProvider, Widget, useWidgetContext } from './WidgetRenderer.jsx'

export { RootRenderer, InstanceRenderer, GlobalStyles, spinnerStyles } from './RootRenderer.jsx'

/**
 * Register all web primitives with a widget registry
 *
 * @param {object} registry - Widget registry from @bassline/widgets
 *
 * @example
 * import { registerWebPrimitives } from '@bassline/ui-web'
 *
 * const widgets = await bl.getModule('widgets')
 * registerWebPrimitives(widgets.registry)
 */
export function registerWebPrimitives(registry) {
  _registerLayoutPrimitives(registry)
  _registerAtomPrimitives(registry)
}

/**
 * Setup helper for ui-web
 *
 * Registers all primitives with the widgets module and returns
 * the configured registry and compile function.
 *
 * @param {object} bl - Bassline instance
 * @returns {Promise<{registry: object, compile: Function}>}
 *
 * @example
 * import { setupUIWeb } from '@bassline/ui-web'
 *
 * const { registry, compile } = await setupUIWeb(bl)
 *
 * // Now render widgets
 * <WidgetRenderer
 *   definition={['button', { label: 'Click' }]}
 *   registry={registry}
 *   compile={compile}
 * />
 */
export async function setupUIWeb(bl) {
  // Get the widgets module
  const widgets = await bl.getModule('widgets')

  // Register web primitives
  registerWebPrimitives(widgets.registry)

  console.log(
    `UI Web primitives registered: ${widgets.registry.listPrimitives().length} primitives`
  )

  return {
    registry: widgets.registry,
    compile: widgets.compile,
  }
}
