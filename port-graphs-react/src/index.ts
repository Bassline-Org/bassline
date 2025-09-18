/**
 * React integration for port-graphs gadgets
 *
 * This package provides hooks and utilities for seamlessly integrating
 * gadgets with React components, using React state as the single source of truth.
 * All gadgets are automatically tappable for easy direct connections.
 */

// Core hook - returns Tappable gadgets
export { useGadget } from './useGadget';

// Tap-based connections
export { useTap, useTaps, useBidirectionalTap } from './useTap';

// Lifecycle management
export * from './lifecycle';

// Context patterns
export * from './useContext';

// Re-export core gadget types for convenience
export type { Gadget, Tappable } from 'port-graphs';
