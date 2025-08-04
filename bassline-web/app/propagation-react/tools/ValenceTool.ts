import type { Tool, ContextFrame } from '~/propagation-react/types/context-frame'
import { toast } from 'sonner'

export class ValenceTool implements Tool {
  id = 'valence'
  name = 'Valence Mode'
  icon = '🔗'
  
  private sourceSelection: { contactIds: string[], groupIds: string[] } | null = null
  
  onActivate(context: ContextFrame): void {
    // Store the current selection as sources
    this.sourceSelection = {
      contactIds: Array.from(context.selection.contactIds),
      groupIds: Array.from(context.selection.groupIds)
    }
    
    const totalSources = this.sourceSelection.contactIds.length + this.sourceSelection.groupIds.length
    if (totalSources === 0) {
      toast.error('Select items first', { duration: 2000 })
      return
    }
    
    // Removed toast - already shown by editor
  }
  
  onDeactivate(): void {
    this.sourceSelection = null
    // Removed toast for exiting valence mode
  }
  
  handleNodeClick(nodeId: string, context: ContextFrame): void {
    // Don't handle clicks - let the existing valence mode system handle them
    // This allows the current working implementation to continue functioning
    return
  }
  
  getNodeHighlight(nodeId: string, context: ContextFrame): string | undefined {
    if (!this.sourceSelection) return undefined
    
    // Highlight source nodes
    if (this.sourceSelection.contactIds.includes(nodeId) || 
        this.sourceSelection.groupIds.includes(nodeId)) {
      return 'ring-4 ring-green-500'
    }
    
    return undefined
  }
  
  getCursor(): string {
    return 'crosshair'
  }
  
  handleKeyPress(event: KeyboardEvent, context: ContextFrame): boolean {
    if (event.key === 'Escape' || event.key === 'v') {
      // Tool will be deactivated by the context manager
      return true
    }
    return false
  }
}