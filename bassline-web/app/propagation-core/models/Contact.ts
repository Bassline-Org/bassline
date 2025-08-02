import type { ContactId, Position, BlendMode } from '../types'
import { Contradiction } from '../types'
import type { ContactGroup } from './ContactGroup'

export class Contact {
  private _content: any = undefined
  private _lastContradiction: Contradiction | null = null
  public isBoundary: boolean = false
  public boundaryDirection?: 'input' | 'output'
  public name?: string
  
  constructor(
    public readonly id: ContactId,
    public position: Position,
    public readonly group: ContactGroup,
    public blendMode: BlendMode = 'accept-last'
  ) {}
  
  get content(): any {
    return this._content
  }
  
  get lastContradiction(): Contradiction | null {
    return this._lastContradiction
  }
  
  setContent(newContent: any, sourceId?: ContactId): void {
    const oldContent = this._content
    
    // Clear previous contradiction if we're getting new content
    this._lastContradiction = null
    
    // Apply blend mode
    if (this._content !== undefined && this.blendMode === 'merge') {
      // Check if both values support merging
      if (this._content?.merge && newContent?.merge) {
        const result = this._content.merge(newContent)
        if (result instanceof Contradiction) {
          this._lastContradiction = result
          this.group.handleContradiction(this.id, result)
          return
        }
        this._content = result
      } else {
        // Can't merge non-mergeable types, fall back to accept-last
        this._content = newContent
      }
    } else {
      // Accept-last mode or no existing content
      this._content = newContent
    }
    
    // Propagate if content changed
    if (this._content !== oldContent) {
      this.propagate()
    }
  }
  
  setBlendMode(mode: 'accept-last' | 'merge'): void {
    this.blendMode = mode
  }
  
  private propagate(): void {
    const connections = this.group.getOutgoingConnections(this.id)
    
    for (const { wire, targetId } of connections) {
      this.group.deliverContent(targetId, this._content, this.id)
    }
    
    // If this is a boundary contact, also check parent group for connections
    if (this.isBoundary && this.group.parent) {
      const parentConnections = this.group.parent.getOutgoingConnections(this.id)
      for (const { wire, targetId } of parentConnections) {
        this.group.parent.deliverContent(targetId, this._content, this.id)
      }
    }
  }
}