/**
 * Types and interfaces for the wrapper component system
 */

import type { ReactNode, MouseEvent } from 'react';
import type { Contact, ContactGroup } from '~/propagation-core';

// Selection types
export interface Selection {
  contacts: Contact[];
  groups: ContactGroup[];
  
  // Helper methods
  isEmpty(): boolean;
  hasContacts(): boolean;
  hasGroups(): boolean;
  hasMixed(): boolean;
  includes(id: string): boolean;
  count(): number;
}

// Node types for wrapper components
export type NodeType = 'contact' | 'group' | 'wire';

// Base props for all interactive wrappers
export interface BaseInteractiveProps {
  id: string;
  type: NodeType;
  className?: string;
  children: ReactNode;
}

// Selection callbacks with current selection passed as argument
export interface SelectionCallbacks {
  onClick?: (selection: Selection) => void;
  onShiftClick?: (selection: Selection) => void;
  onCommandClick?: (selection: Selection) => void;
  onDoubleClick?: (selection: Selection) => void;
}

// Props for the Selectable wrapper
export interface SelectableProps extends BaseInteractiveProps {
  // Selection behaviors
  onClick?: (selection: Selection) => void;
  onShiftClick?: (selection: Selection) => void;
  onCommandClick?: (selection: Selection) => void;
  onDoubleClick?: (selection: Selection) => void;
  
  // Selection state changes
  onSelect?: (selection: Selection) => void;
  onDeselect?: (previousSelection: Selection) => void;
  
  // Integration options
  inFlow?: boolean; // Integrate with React Flow selection
}

// Mode-specific behavior configuration
export interface ModeBehavior {
  onClick?: (selection: Selection) => void;
  onDoubleClick?: (selection: Selection) => void;
  canInteract?: (selection: Selection) => boolean;
  className?: string;
  cursor?: string;
}

// Tool display rules for dynamic UI
export interface ToolDisplayRules {
  getNodeDisplay?: (nodeId: string, selection: Selection) => NodeDisplayConfig;
  getEdgeDisplay?: (edgeId: string, selection: Selection) => EdgeDisplayConfig;
}

export interface NodeDisplayConfig {
  className?: string;
  badge?: ReactNode;
  overlay?: ReactNode;
  opacity?: number;
  interactive?: boolean;
  cursor?: string;
}

export interface EdgeDisplayConfig {
  className?: string;
  animated?: boolean;
  strokeWidth?: number;
  opacity?: number;
}

// Props for the unified Interactive wrapper
export interface InteractiveProps extends BaseInteractiveProps {
  // Selection behaviors
  selection?: SelectionCallbacks;
  selected?: boolean;  // React Flow selection state
  
  // Mode-specific behaviors
  modes?: Record<string, ModeBehavior>;
  
  // Lifecycle
  onDelete?: () => void;
  onDragStart?: () => void;
  onDragEnd?: (position: { x: number; y: number }) => void;
  
  // Context menu
  contextMenu?: (selection: Selection) => ReactNode;
  
  // Tooltip
  tooltip?: (nodeId: string, selection: Selection) => ReactNode;
}

// Props for React Flow integration wrapper
export interface FlowNodeProps {
  id: string;
  selected?: boolean;
  interactive?: Omit<InteractiveProps, 'id' | 'children'>;
  className?: string;
  children: ReactNode;
}

// Helper to create a Selection object
export function createSelection(contacts: Contact[], groups: ContactGroup[]): Selection {
  return {
    contacts,
    groups,
    isEmpty: () => contacts.length === 0 && groups.length === 0,
    hasContacts: () => contacts.length > 0,
    hasGroups: () => groups.length > 0,
    hasMixed: () => contacts.length > 0 && groups.length > 0,
    includes: (id: string) => 
      contacts.some(c => c.id === id) || groups.some(g => g.id === id),
    count: () => contacts.length + groups.length,
  };
}

// Empty selection constant
export const EMPTY_SELECTION: Selection = createSelection([], []);