/**
 * ModeContext implementation
 * Provides read-only state and command interface to modes
 */

import type {
  ModeContext,
  Selection,
  ViewState,
  InteractionPoint,
  Commands,
  Annotations,
  ConnectionPreview,
  SelectionPreview
} from './types'
import type { PropagationNetwork } from '~/propagation-core'

// Implementation of Selection interface
export class SelectionImpl implements Selection {
  nodes = new Set<string>()
  edges = new Set<string>()
  
  isEmpty(): boolean {
    return this.nodes.size === 0 && this.edges.size === 0
  }
  
  has(id: string): boolean {
    return this.nodes.has(id) || this.edges.has(id)
  }
  
  clear(): void {
    this.nodes.clear()
    this.edges.clear()
  }
  
  add(id: string): void {
    // Determine if it's a node or edge based on the network
    // For now, assume nodes (will be connected to actual network later)
    this.nodes.add(id)
  }
  
  remove(id: string): void {
    this.nodes.delete(id)
    this.edges.delete(id)
  }
  
  toggle(id: string): void {
    if (this.has(id)) {
      this.remove(id)
    } else {
      this.add(id)
    }
  }
  
  replace(ids: string[]): void {
    this.clear()
    ids.forEach(id => this.add(id))
  }
  
  // Helper to get all selected IDs
  getAllIds(): string[] {
    return [...this.nodes, ...this.edges]
  }
}

// Implementation of Annotations
class AnnotationsImpl implements Annotations {
  private highlights = new Map<string, string>()
  private dimmed = new Set<string>()
  private badges = new Map<string, { text: string; position?: string }>()
  private preview: ConnectionPreview | SelectionPreview | null = null
  
  highlight(ids: string[], className: string): void {
    ids.forEach(id => this.highlights.set(id, className))
  }
  
  dim(ids: string[]): void {
    ids.forEach(id => this.dimmed.add(id))
  }
  
  badge(nodeId: string, text: string, position?: 'top' | 'bottom' | 'left' | 'right'): void {
    this.badges.set(nodeId, { text, position })
  }
  
  showPreview(preview: ConnectionPreview | SelectionPreview): void {
    this.preview = preview
  }
  
  clearAll(): void {
    this.highlights.clear()
    this.dimmed.clear()
    this.badges.clear()
    this.preview = null
  }
  
  // Getters for rendering
  getHighlight(id: string): string | undefined {
    return this.highlights.get(id)
  }
  
  isDimmed(id: string): boolean {
    return this.dimmed.has(id)
  }
  
  getBadge(id: string): { text: string; position?: string } | undefined {
    return this.badges.get(id)
  }
  
  getPreview(): ConnectionPreview | SelectionPreview | null {
    return this.preview
  }
}

// Mode context builder
export interface ModeContextConfig {
  network: PropagationNetwork
  selection: Selection
  focus: string | null
  viewState: ViewState
  interactionPoint: InteractionPoint
  commands: Commands
}

export function createModeContext(config: ModeContextConfig): ModeContext {
  const annotations = new AnnotationsImpl()
  
  return {
    network: config.network,
    selection: config.selection,
    focus: config.focus,
    viewState: config.viewState,
    interactionPoint: config.interactionPoint,
    commands: config.commands,
    annotations
  }
}

// Helper to create default interaction point
export function createDefaultInteractionPoint(): InteractionPoint {
  return {
    x: 0,
    y: 0,
    isDragging: false
  }
}

// Helper to create default view state
export function createDefaultViewState(currentGroupId: string): ViewState {
  return {
    zoom: 1,
    center: { x: 0, y: 0 },
    currentGroupId
  }
}