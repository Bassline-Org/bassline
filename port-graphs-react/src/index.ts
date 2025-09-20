/**
 * React integration for port-graphs gadgets
 *
 * This package provides hooks and utilities for seamlessly integrating
 * gadgets with React components, using a global provider for state management.
 */

// Provider for global gadget state management
export { GadgetProvider, useGadgetContext } from './GadgetProvider';

// Core hook - polymorphic, supports both direct and family gadgets
export { useGadget } from './useGadget';

// Family creation helper
export { createReactFamily } from './createReactFamily';

// Declarative wiring components
export { GadgetContext, ProvideGadget, useCurrentGadget, useExplicitGadget } from './GadgetContext';
export { Tap } from './Tap';

// Visual components for tap connections
export * from './visual';

// Re-export core gadget types for convenience
export type { Gadget, Tappable } from 'port-graphs';
