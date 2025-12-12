/**
 * Widget Upgrade Module
 *
 * Installs the widget system into a Bassline instance.
 *
 * This module provides:
 * - Widget registry for primitives and custom widgets
 * - Compiler for resolving hiccup definitions to render trees
 * - Routes for managing widgets as resources (GET/PUT)
 *
 * Platform renderers (React, Solid, etc.) should call registerPrimitive()
 * to register their primitive implementations.
 */

import { createWidgetRegistry } from './registry.js'
import { createCompiler } from './compiler.js'
import { createWidgetRoutes } from './routes.js'
import { createUIRoutes } from './instances.js'

/**
 * Install widgets into a Bassline instance.
 * @param {import('@bassline/core').Bassline} bl - Bassline instance
 */
export default function installWidgets(bl) {
  // Create registry
  const registry = createWidgetRegistry()

  // Create compiler and wire it up
  const compile = createCompiler(registry)
  registry.setCompiler(compile)

  // Create and install routes at /widgets
  const widgetRoutes = createWidgetRoutes({ registry, compile })
  widgetRoutes.install(bl)

  // Create and install UI instance routes at /ui
  const uiRoutes = createUIRoutes({ bl })
  uiRoutes.install(bl)

  // The widgets module interface
  const widgets = {
    registry,
    compile,
    get: registry.get,
    getSync: registry.getSync,
    registerPrimitive: registry.registerPrimitive,
    registerAll: registry.registerAll,
    registerCustom: registry.registerCustom,
    deleteCustom: registry.deleteCustom,
    has: registry.has,
    isPrimitive: registry.isPrimitive,
    listAll: registry.listAll,
    listPrimitives: registry.listPrimitives,
    listCustom: registry.listCustom,
    // UI instance management
    ui: {
      getInstance: uiRoutes.getInstance,
      setInstance: uiRoutes.setInstance,
      updateState: uiRoutes.updateState,
      deleteInstance: uiRoutes.deleteInstance,
      listInstances: uiRoutes.listInstances,
    },
  }

  // Register as module for platform renderers to access
  bl.setModule('widgets', widgets)

  console.log('Widgets module installed: /widgets, /ui')
}
