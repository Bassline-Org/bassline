/**
 * React integration for port-graphs gadgets
 *
 * This package provides hooks and utilities for seamlessly integrating
 * gadgets with React components, using a global provider for state management.
 */

// Provider for global gadget state management
export { GadgetProvider, useGadgetContext } from './GadgetProvider';

// Core hooks for typed gadgets
export { useGadget } from './useGadget';
export { useGadgetMap } from './useGadgetMap';

// Effect hooks for typed gadgets
export { useGadgetEffect } from './useGadgetEffect';

// Typed React components for UI gadgets
export * from './components';

// Family creation helper
export { createReactFamily } from './createReactFamily';

// Declarative wiring components
export { GadgetContext, ProvideGadget, useCurrentGadget, useExplicitGadget } from './GadgetContext';