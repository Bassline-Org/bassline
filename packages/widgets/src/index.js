/**
 * @module @bassline/widgets
 *
 * Widget registry and compiler for Bassline UI.
 *
 * Widgets are resources:
 * - Definitions at bl:///widgets/*
 * - Instances at bl:///ui/* (managed by renderer)
 *
 * Widget types:
 * - Primitives: Platform-specific implementations (button, stack, etc.)
 * - Custom: Compositions of other widgets via hiccup definitions
 */

export { createWidgetRegistry } from './registry.js'
export { createCompiler, walkTree, collectWidgetRefs } from './compiler.js'
export { createWidgetRoutes } from './routes.js'
export { createUIRoutes } from './instances.js'
export { default as installWidgets } from './upgrade.js'
