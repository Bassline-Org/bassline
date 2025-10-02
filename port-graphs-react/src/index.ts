/**
 * port-graphs-react - React integration for port-graphs sugar layer
 *
 * This package provides React hooks that expose sugar gadgets to React components.
 * All hooks return [value, gadget] tuples where:
 * - value: The current state (for rendering)
 * - gadget: The gadget object (for operations, wiring, and passing to other hooks)
 *
 * Core hooks:
 * - useGadget: Subscribe to an existing gadget (module-level, prop, context)
 * - useLocalGadget: Create a component-local gadget
 * - useDerive: Create derived/computed values from multiple sources
 * - useTable: Create a component-local table gadget
 * - useFunction: Create a component-local function gadget
 */

// Core hooks
export { useGadget } from './useGadget';
export { useLocalGadget } from './useLocalGadget';
export { useDerive } from './useDerive';
export { useTable } from './useTable';
export { useFunction } from './useFunction';