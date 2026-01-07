/**
 * Command Pattern for Visual Editor
 *
 * All mutations go through commands, enabling:
 * - Undo/redo for supported operations
 * - Single source of truth (database)
 * - Consistent mutation handling
 */

// =============================================================================
// Command Interface
// =============================================================================

export interface Command {
  /** Command type identifier */
  readonly type: string

  /** Execute the command */
  execute(): Promise<void>

  /** Undo the command (if supported) */
  undo?(): Promise<void>

  /** Re-execute after undo (uses execute() by default) */
  redo?(): Promise<void>
}

// =============================================================================
// Command Executor
// =============================================================================

export class CommandExecutor {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private onExecute: () => void

  constructor(onExecute: () => void) {
    this.onExecute = onExecute
  }

  async execute(command: Command): Promise<void> {
    await command.execute()

    // Only track undoable commands
    if (command.undo) {
      this.undoStack.push(command)
      this.redoStack = [] // Clear redo stack on new command
    }

    this.onExecute()
  }

  async undo(): Promise<void> {
    const command = this.undoStack.pop()
    if (command?.undo) {
      await command.undo()
      this.redoStack.push(command)
      this.onExecute()
    }
  }

  async redo(): Promise<void> {
    const command = this.redoStack.pop()
    if (command) {
      if (command.redo) {
        await command.redo()
      } else {
        await command.execute()
      }
      this.undoStack.push(command)
      this.onExecute()
    }
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** Clear all history */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}

// =============================================================================
// Attribute Commands (Undoable)
// =============================================================================

export class SetAttrCommand implements Command {
  readonly type = 'setAttr'
  private previousValue: string | null = null
  private hadValue = false

  constructor(
    private entityId: string,
    private key: string,
    private value: string
  ) {}

  async execute(): Promise<void> {
    // Save current value for undo
    const attrs = await window.db.attrs.get(this.entityId)
    this.hadValue = this.key in attrs
    this.previousValue = attrs[this.key] ?? null

    await window.db.attrs.set(this.entityId, this.key, this.value)
  }

  async undo(): Promise<void> {
    if (this.hadValue && this.previousValue !== null) {
      await window.db.attrs.set(this.entityId, this.key, this.previousValue)
    } else {
      await window.db.attrs.delete(this.entityId, this.key)
    }
  }
}

export class DeleteAttrCommand implements Command {
  readonly type = 'deleteAttr'
  private previousValue: string | null = null

  constructor(
    private entityId: string,
    private key: string
  ) {}

  async execute(): Promise<void> {
    // Save current value for undo
    const attrs = await window.db.attrs.get(this.entityId)
    this.previousValue = attrs[this.key] ?? null

    await window.db.attrs.delete(this.entityId, this.key)
  }

  async undo(): Promise<void> {
    if (this.previousValue !== null) {
      await window.db.attrs.set(this.entityId, this.key, this.previousValue)
    }
  }
}

export class SetAttrBatchCommand implements Command {
  readonly type = 'setAttrBatch'
  private previousValues: Record<string, string | null> = {}

  constructor(
    private entityId: string,
    private attrs: Record<string, string>
  ) {}

  async execute(): Promise<void> {
    // Save current values for undo
    const currentAttrs = await window.db.attrs.get(this.entityId)
    for (const key of Object.keys(this.attrs)) {
      this.previousValues[key] = currentAttrs[key] ?? null
    }

    await window.db.attrs.setBatch(this.entityId, this.attrs)
  }

  async undo(): Promise<void> {
    const toSet: Record<string, string> = {}
    const toDelete: string[] = []

    for (const [key, prevValue] of Object.entries(this.previousValues)) {
      if (prevValue !== null) {
        toSet[key] = prevValue
      } else {
        toDelete.push(key)
      }
    }

    if (Object.keys(toSet).length > 0) {
      await window.db.attrs.setBatch(this.entityId, toSet)
    }
    for (const key of toDelete) {
      await window.db.attrs.delete(this.entityId, key)
    }
  }
}

// =============================================================================
// Entity Commands (Undoable)
// =============================================================================

export class CreateEntityCommand implements Command {
  readonly type = 'createEntity'
  private createdEntityId: string | null = null

  constructor(
    private projectId: string,
    private initialAttrs: Record<string, string> = {}
  ) {}

  async execute(): Promise<void> {
    const entity = await window.db.entities.create(this.projectId)
    this.createdEntityId = entity.id

    if (Object.keys(this.initialAttrs).length > 0) {
      await window.db.attrs.setBatch(entity.id, this.initialAttrs)
    }
  }

  async undo(): Promise<void> {
    if (this.createdEntityId) {
      await window.db.entities.delete(this.createdEntityId)
    }
  }

  getCreatedEntityId(): string | null {
    return this.createdEntityId
  }
}

/** Saved state for entity restoration */
interface SavedEntityState {
  id: string
  project_id: string
  created_at: number
  modified_at: number
  attrs: Record<string, string>
  /** Relationships where this entity is from_entity or to_entity */
  relationships: Array<{
    id: string
    project_id: string
    from_entity: string
    to_entity: string
    kind: string
    label: string | null
    binding_name: string | null
  }>
}

export class DeleteEntityCommand implements Command {
  readonly type = 'deleteEntity'
  private savedState: SavedEntityState | null = null

  constructor(private entityId: string) {}

  async execute(): Promise<void> {
    // Save entity state before deletion for undo
    const entity = await window.db.entities.get(this.entityId)
    if (!entity) return

    // Get all relationships involving this entity
    const allRels = await window.db.relationships.list(entity.project_id)
    const relatedRels = allRels.filter(
      (r) => r.from_entity === this.entityId || r.to_entity === this.entityId
    )

    this.savedState = {
      id: entity.id,
      project_id: entity.project_id,
      created_at: entity.created_at,
      modified_at: entity.modified_at,
      attrs: entity.attrs,
      relationships: relatedRels,
    }

    await window.db.entities.delete(this.entityId)
  }

  async undo(): Promise<void> {
    if (!this.savedState) return

    // Restore entity with same ID
    await window.db.entities.createWithId(
      this.savedState.project_id,
      this.savedState.id,
      {
        created_at: this.savedState.created_at,
        modified_at: this.savedState.modified_at,
      }
    )

    // Restore attrs
    if (Object.keys(this.savedState.attrs).length > 0) {
      await window.db.attrs.setBatch(this.savedState.id, this.savedState.attrs)
    }

    // Restore relationships with same IDs
    for (const rel of this.savedState.relationships) {
      await window.db.relationships.createWithId(rel.project_id, rel.id, {
        from_entity: rel.from_entity,
        to_entity: rel.to_entity,
        kind: rel.kind as 'contains' | 'connects' | 'binds',
        label: rel.label,
        binding_name: rel.binding_name,
      })
    }
  }
}

// =============================================================================
// Relationship Commands (Undoable)
// =============================================================================

export class CreateRelationshipCommand implements Command {
  readonly type = 'createRelationship'
  private createdRelationshipId: string | null = null

  constructor(
    private projectId: string,
    private data: {
      from_entity: string
      to_entity: string
      kind: 'contains' | 'connects' | 'binds'
      label?: string | null
      binding_name?: string | null
    }
  ) {}

  async execute(): Promise<void> {
    const rel = await window.db.relationships.create(this.projectId, {
      from_entity: this.data.from_entity,
      to_entity: this.data.to_entity,
      kind: this.data.kind,
      label: this.data.label ?? null,
      binding_name: this.data.binding_name ?? null,
    })
    this.createdRelationshipId = rel.id
  }

  async undo(): Promise<void> {
    if (this.createdRelationshipId) {
      await window.db.relationships.delete(this.createdRelationshipId)
    }
  }
}

/** Saved state for relationship restoration */
interface SavedRelationshipState {
  id: string
  project_id: string
  from_entity: string
  to_entity: string
  kind: string
  label: string | null
  binding_name: string | null
}

export class DeleteRelationshipCommand implements Command {
  readonly type = 'deleteRelationship'
  private savedState: SavedRelationshipState | null = null

  constructor(private relationshipId: string) {}

  async execute(): Promise<void> {
    // Save relationship state before deletion for undo
    const rel = await window.db.relationships.get(this.relationshipId)
    if (rel) {
      this.savedState = rel
    }
    await window.db.relationships.delete(this.relationshipId)
  }

  async undo(): Promise<void> {
    if (!this.savedState) return

    // Restore relationship with same ID
    await window.db.relationships.createWithId(
      this.savedState.project_id,
      this.savedState.id,
      {
        from_entity: this.savedState.from_entity,
        to_entity: this.savedState.to_entity,
        kind: this.savedState.kind as 'contains' | 'connects' | 'binds',
        label: this.savedState.label,
        binding_name: this.savedState.binding_name,
      }
    )
  }
}

// Convenience command for containment (undoable)
export class ContainCommand implements Command {
  readonly type = 'contain'
  private createdRelationshipId: string | null = null

  constructor(
    private projectId: string,
    private parentId: string,
    private childId: string
  ) {}

  async execute(): Promise<void> {
    const rel = await window.db.relationships.create(this.projectId, {
      from_entity: this.parentId,
      to_entity: this.childId,
      kind: 'contains',
      label: null,
      binding_name: null,
    })
    this.createdRelationshipId = rel.id
  }

  async undo(): Promise<void> {
    if (this.createdRelationshipId) {
      await window.db.relationships.delete(this.createdRelationshipId)
    }
  }
}

export class UncontainCommand implements Command {
  readonly type = 'uncontain'
  private deletedRelationship: SavedRelationshipState | null = null

  constructor(
    private projectId: string,
    private childId: string
  ) {}

  async execute(): Promise<void> {
    const relationships = await window.db.relationships.list(this.projectId)
    const containsRel = relationships.find(
      (r) => r.kind === 'contains' && r.to_entity === this.childId
    )
    if (containsRel) {
      // Save for undo
      this.deletedRelationship = containsRel
      await window.db.relationships.delete(containsRel.id)
    }
  }

  async undo(): Promise<void> {
    if (!this.deletedRelationship) return

    await window.db.relationships.createWithId(
      this.deletedRelationship.project_id,
      this.deletedRelationship.id,
      {
        from_entity: this.deletedRelationship.from_entity,
        to_entity: this.deletedRelationship.to_entity,
        kind: this.deletedRelationship.kind as 'contains' | 'connects' | 'binds',
        label: this.deletedRelationship.label,
        binding_name: this.deletedRelationship.binding_name,
      }
    )
  }
}

// =============================================================================
// Stamp Commands (Structural)
// =============================================================================

export class CreateStampCommand implements Command {
  readonly type = 'createStamp'

  constructor(
    private sourceEntityId: string,
    private stampName: string
  ) {}

  async execute(): Promise<void> {
    await window.db.stamps.create({
      name: this.stampName,
      sourceEntityId: this.sourceEntityId,
      kind: 'template',
    })
  }
}

export class ApplyStampCommand implements Command {
  readonly type = 'applyStamp'

  constructor(
    private stampId: string,
    private targetEntityId: string
  ) {}

  async execute(): Promise<void> {
    await window.db.stamps.apply(this.stampId, this.targetEntityId)
  }
}

export class DeleteStampCommand implements Command {
  readonly type = 'deleteStamp'

  constructor(private stampId: string) {}

  async execute(): Promise<void> {
    await window.db.stamps.delete(this.stampId)
  }
}

// =============================================================================
// UI State Commands (Not undoable - UI state is ephemeral)
// =============================================================================

export class ViewportChangeCommand implements Command {
  readonly type = 'viewportChange'

  constructor(
    private projectId: string,
    private viewport: { x: number; y: number; zoom: number }
  ) {}

  async execute(): Promise<void> {
    await window.db.uiState.update(this.projectId, {
      viewport_x: this.viewport.x,
      viewport_y: this.viewport.y,
      viewport_zoom: this.viewport.zoom,
    })
  }
}
