import { useLoaderData, Link } from 'react-router'
import { useCallback, useState, useMemo } from 'react'
import { ArrowLeft, Settings, Stamp } from 'lucide-react'
import type { EditorLoaderData } from '../types'
import { Canvas } from '../components/Canvas'
import { PropertyPanel } from '../components/PropertyPanel'
import { StampsPanel } from '../components/StampsPanel'
import { DeleteContainerDialog, type DeleteContainerAction } from '../components/DeleteContainerDialog'
import { MultiSelectPanel } from '../components/MultiSelectPanel'
import { Button } from '@/components/ui/button'
import { useVocabulary } from '../hooks/useVocabulary'
import { useBl } from '../hooks/useBl'
import { useCommands } from '../hooks/useCommands'
import { VocabularyContext } from '../contexts/VocabularyContext'
import { SemanticOutputProvider } from '../contexts/SemanticOutputContext'

export function Editor() {
  const { project, entities, relationships, stamps, uiState } = useLoaderData() as EditorLoaderData
  const { bl, revalidate } = useBl()

  // Local selection state - NOT persisted to DB
  // Using Set for multi-selection support
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set())

  // Helper for single selection (backwards compat with PropertyPanel)
  const selectedEntityId = selectedEntityIds.size === 1
    ? [...selectedEntityIds][0]
    : null

  // Stamps panel visibility
  const [stampsPanelOpen, setStampsPanelOpen] = useState(false)

  // Project name editing
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState(project.name)

  // Delete container dialog state
  const [deleteDialogState, setDeleteDialogState] = useState<{
    open: boolean
    entityId: string
    childCount: number
    entityName: string
  }>({ open: false, entityId: '', childCount: 0, entityName: '' })

  // Parse vocabulary from stamps
  const vocabulary = useVocabulary(stamps)

  // Copy/paste commands (Cmd+C/Cmd+V)
  useCommands({
    projectId: project.id,
    entities,
    relationships,
    selectedEntityIds,
    onPaste: (newEntityIds) => setSelectedEntityIds(new Set(newEntityIds)),
    revalidate,
  })

  const selectedEntity = entities.find((e) => e.id === selectedEntityId)

  // Build child count lookup from contains relationships
  const childCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const rel of relationships) {
      if (rel.kind === 'contains') {
        counts[rel.from_entity] = (counts[rel.from_entity] || 0) + 1
      }
    }
    return counts
  }, [relationships])

  const handleCreateEntity = useCallback(
    async (x: number, y: number) => {
      const name = `Entity ${entities.length + 1}`
      await bl.entities.create(project.id, {
        name,
        x: Math.round(x).toString(),
        y: Math.round(y).toString(),
      })
      revalidate()
    },
    [bl, revalidate, entities.length, project.id]
  )

  const handleCreateSemantic = useCallback(
    async (x: number, y: number, semanticType: string) => {
      await bl.entities.create(project.id, {
        'semantic.type': semanticType,
        x: Math.round(x).toString(),
        y: Math.round(y).toString(),
        'ui.width': '300',
        'ui.height': '250',
      })
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleMoveEntity = useCallback(
    async (entityId: string, x: number, y: number) => {
      await bl.attrs.setBatch(project.id, entityId, {
        x: Math.round(x).toString(),
        y: Math.round(y).toString(),
      })
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleResizeEntity = useCallback(
    async (entityId: string, width: number, height: number) => {
      await bl.attrs.setBatch(project.id, entityId, {
        'ui.width': Math.round(width).toString(),
        'ui.height': Math.round(height).toString(),
      })
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleSelectEntity = useCallback(
    (entityId: string | null) => {
      // Replace selection with single entity (or clear)
      setSelectedEntityIds(entityId ? new Set([entityId]) : new Set())
    },
    []
  )

  const handleSelectEntities = useCallback(
    (entityIds: Set<string>) => {
      setSelectedEntityIds(entityIds)
    },
    []
  )

  const handleConnect = useCallback(
    async (from: string, to: string, fromPort: string | null, toPort: string | null) => {
      await bl.relationships.create(project.id, {
        from_entity: from,
        to_entity: to,
        kind: 'connects',
        from_port: fromPort,
        to_port: toPort,
      })
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleDeleteEntity = useCallback(
    async (entityId: string) => {
      const entityChildCount = childCounts[entityId] || 0
      const entity = entities.find(e => e.id === entityId)

      // If it's a container with children, show the dialog
      if (entityChildCount > 0) {
        setDeleteDialogState({
          open: true,
          entityId,
          childCount: entityChildCount,
          entityName: entity?.attrs.name || 'Unnamed',
        })
        return
      }

      // Clear from selection if deleting selected entity
      setSelectedEntityIds((prev) => {
        if (prev.has(entityId)) {
          const next = new Set(prev)
          next.delete(entityId)
          return next
        }
        return prev
      })
      await bl.entities.delete(project.id, entityId)
      revalidate()
    },
    [bl, revalidate, project.id, childCounts, entities]
  )

  const handleDeleteContainerAction = useCallback(
    async (action: DeleteContainerAction) => {
      const { entityId } = deleteDialogState

      // Close dialog first
      setDeleteDialogState(prev => ({ ...prev, open: false }))

      if (action === 'cancel') {
        return
      }

      // Clear from selection
      setSelectedEntityIds((prev) => {
        if (prev.has(entityId)) {
          const next = new Set(prev)
          next.delete(entityId)
          return next
        }
        return prev
      })

      if (action === 'delete-all') {
        // Cascade delete - delete container and all children
        await bl.entities.delete(project.id, entityId, { cascade: true })
      } else {
        // Delete container only - children become orphans
        await bl.entities.delete(project.id, entityId)
      }

      revalidate()
    },
    [bl, revalidate, project.id, deleteDialogState]
  )

  const handleDeleteEntities = useCallback(
    async (entityIds: string[]) => {
      // Clear selection
      setSelectedEntityIds(new Set())
      // Delete all
      for (const id of entityIds) {
        await bl.entities.delete(project.id, id)
      }
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleViewportChange = useCallback(
    async (x: number, y: number, zoom: number) => {
      // Viewport changes are not undoable - UI state is ephemeral
      await bl.uiState.update(project.id, {
        viewport_x: x,
        viewport_y: y,
        viewport_zoom: zoom,
      })
      // No revalidate needed for viewport - it's ephemeral UI state
    },
    [bl, project.id]
  )

  const handleUpdateAttr = useCallback(
    async (entityId: string, key: string, value: string) => {
      await bl.attrs.set(project.id, entityId, key, value)
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleDeleteAttr = useCallback(
    async (entityId: string, key: string) => {
      await bl.attrs.delete(project.id, entityId, key)
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleSaveAsStamp = useCallback(
    async (entityId: string, stampName: string) => {
      await bl.stamps.create({ name: stampName, sourceEntityId: entityId })
      revalidate()
    },
    [bl, revalidate]
  )

  const handleApplyStamp = useCallback(
    async (stampId: string, entityId: string) => {
      await bl.stamps.apply(stampId, entityId)
      revalidate()
    },
    [bl, revalidate]
  )

  const handleContain = useCallback(
    async (parentId: string, childId: string) => {
      await bl.relationships.create(project.id, {
        from_entity: parentId,
        to_entity: childId,
        kind: 'contains',
      })
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleUncontain = useCallback(
    async (childId: string) => {
      // Find and delete the contains relationship for this child
      const containsRel = relationships.find(
        (r) => r.to_entity === childId && r.kind === 'contains'
      )
      if (containsRel) {
        await bl.relationships.delete(project.id, containsRel.id)
        revalidate()
      }
    },
    [bl, revalidate, project.id, relationships]
  )

  const handleBindTo = useCallback(
    async (sourceId: string, targetId: string) => {
      await bl.relationships.create(project.id, {
        from_entity: sourceId,
        to_entity: targetId,
        kind: 'binds',
      })
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleDeleteRelationship = useCallback(
    async (relationshipId: string) => {
      await bl.relationships.delete(project.id, relationshipId)
      revalidate()
    },
    [bl, revalidate, project.id]
  )

  const handleDeleteStamp = useCallback(
    async (stampId: string) => {
      await bl.stamps.delete(stampId)
      revalidate()
    },
    [bl, revalidate]
  )

  const handleRenameProject = useCallback(
    async () => {
      const trimmed = editingName.trim()
      if (trimmed && trimmed !== project.name) {
        await bl.projects.update(project.id, { name: trimmed })
        revalidate()
      }
      setIsEditingName(false)
    },
    [bl, revalidate, project.id, project.name, editingName]
  )

  const handleBundle = useCallback(
    async () => {
      if (selectedEntityIds.size < 2) return

      // Get selected entities
      const selectedEntities = entities.filter(e => selectedEntityIds.has(e.id))

      // Calculate bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const e of selectedEntities) {
        const x = parseFloat(e.attrs.x || '0')
        const y = parseFloat(e.attrs.y || '0')
        const w = parseFloat(e.attrs['ui.width'] || '120')
        const h = parseFloat(e.attrs['ui.height'] || '60')
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x + w)
        maxY = Math.max(maxY, y + h)
      }

      // Add padding
      const padding = 20
      minX -= padding
      minY -= padding
      const width = maxX - minX + padding
      const height = maxY - minY + padding

      // Start batch to collect operations, then cancel to make non-undoable
      await bl.history.beginBatch()

      // Create container entity
      const container = await bl.entities.create(project.id, {
        name: 'Group',
        x: Math.round(minX).toString(),
        y: Math.round(minY).toString(),
        'ui.width': Math.round(width).toString(),
        'ui.height': Math.round(height).toString(),
      })

      // Create contains relationships and update child positions
      for (const e of selectedEntities) {
        await bl.relationships.create(project.id, {
          from_entity: container.id,
          to_entity: e.id,
          kind: 'contains',
        })

        // Update entity position to be relative to container
        const x = parseFloat(e.attrs.x || '0')
        const y = parseFloat(e.attrs.y || '0')
        await bl.attrs.setBatch(project.id, e.id, {
          x: Math.round(x - minX).toString(),
          y: Math.round(y - minY).toString(),
        })
      }

      // Cancel batch - discards history entries, making this non-undoable
      await bl.history.cancelBatch()

      // Select the new container
      setSelectedEntityIds(new Set([container.id]))
      revalidate()
    },
    [bl, revalidate, project.id, selectedEntityIds, entities]
  )

  const handleUnbundle = useCallback(
    async () => {
      if (selectedEntityIds.size !== 1) return

      const containerId = [...selectedEntityIds][0]
      const container = entities.find(e => e.id === containerId)
      if (!container) return

      const containerX = parseFloat(container.attrs.x || '0')
      const containerY = parseFloat(container.attrs.y || '0')

      // Find all children
      const childRels = relationships.filter(
        r => r.kind === 'contains' && r.from_entity === containerId
      )

      if (childRels.length === 0) return

      // Start batch to collect operations, then cancel to make non-undoable
      await bl.history.beginBatch()

      // Update each child's position to absolute and delete relationship
      const childIds: string[] = []
      for (const rel of childRels) {
        const child = entities.find(e => e.id === rel.to_entity)
        if (child) {
          const childX = parseFloat(child.attrs.x || '0')
          const childY = parseFloat(child.attrs.y || '0')

          await bl.attrs.setBatch(project.id, rel.to_entity, {
            x: Math.round(containerX + childX).toString(),
            y: Math.round(containerY + childY).toString(),
          })
          childIds.push(child.id)
        }

        // Delete contains relationship
        await bl.relationships.delete(project.id, rel.id)
      }

      // Delete the container entity
      await bl.entities.delete(project.id, containerId)

      // Cancel batch - discards history entries, making this non-undoable
      await bl.history.cancelBatch()

      // Select the former children
      setSelectedEntityIds(new Set(childIds))
      revalidate()
    },
    [bl, revalidate, project.id, selectedEntityIds, entities, relationships]
  )

  return (
    <VocabularyContext.Provider value={vocabulary}>
      <SemanticOutputProvider>
      <DeleteContainerDialog
        open={deleteDialogState.open}
        childCount={deleteDialogState.childCount}
        containerName={deleteDialogState.entityName}
        onAction={handleDeleteContainerAction}
      />
      <div className="h-screen flex flex-col">
        <header className="flex items-center gap-4 px-6 py-3 bg-card border-b border-border">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Projects
          </Link>
        </Button>
        {isEditingName ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleRenameProject}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameProject()
              if (e.key === 'Escape') {
                setEditingName(project.name)
                setIsEditingName(false)
              }
            }}
            className="text-base font-medium bg-transparent border-b border-primary outline-none px-1"
            autoFocus
          />
        ) : (
          <h1
            className="text-base font-medium cursor-pointer hover:text-primary"
            onClick={() => {
              setEditingName(project.name)
              setIsEditingName(true)
            }}
            title="Click to rename"
          >
            {project.name}
          </h1>
        )}
        <div className="flex-1" />
        <Button
          variant={stampsPanelOpen ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setStampsPanelOpen(!stampsPanelOpen)}
          title="Stamps"
        >
          <Stamp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings" title="Settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {stampsPanelOpen && (
          <StampsPanel
            stamps={stamps}
            onClose={() => setStampsPanelOpen(false)}
            onDeleteStamp={handleDeleteStamp}
          />
        )}

        <div className="flex-1 bg-background">
          <Canvas
            entities={entities}
            relationships={relationships}
            stamps={stamps}
            selectedEntityIds={selectedEntityIds}
            uiState={uiState}
            onCreateEntity={handleCreateEntity}
            onCreateSemantic={handleCreateSemantic}
            onMoveEntity={handleMoveEntity}
            onResizeEntity={handleResizeEntity}
            onSelectEntities={handleSelectEntities}
            onDeleteEntity={handleDeleteEntity}
            onDeleteEntities={handleDeleteEntities}
            onDeleteRelationship={handleDeleteRelationship}
            onConnect={handleConnect}
            onContain={handleContain}
            onUncontain={handleUncontain}
            onBindTo={handleBindTo}
            onViewportChange={handleViewportChange}
            onSaveAsStamp={handleSaveAsStamp}
            onApplyStamp={handleApplyStamp}
            onBundle={handleBundle}
            onUnbundle={handleUnbundle}
          />
        </div>

        {selectedEntityIds.size > 1 ? (
          <MultiSelectPanel
            entities={entities.filter(e => selectedEntityIds.has(e.id))}
            hasContainer={entities.some(e => selectedEntityIds.has(e.id) && childCounts[e.id] > 0)}
            onDelete={() => handleDeleteEntities([...selectedEntityIds])}
            onBundle={handleBundle}
            onUnbundle={selectedEntityIds.size === 1 ? handleUnbundle : undefined}
            onClose={() => handleSelectEntity(null)}
          />
        ) : selectedEntity && (
          <PropertyPanel
            entity={selectedEntity}
            entities={entities}
            relationships={relationships}
            vocabulary={vocabulary}
            onUpdateAttr={(key, value) => handleUpdateAttr(selectedEntity.id, key, value)}
            onDeleteAttr={(key) => handleDeleteAttr(selectedEntity.id, key)}
            onDeleteRelationship={handleDeleteRelationship}
            onDelete={() => handleDeleteEntity(selectedEntity.id)}
            onClose={() => handleSelectEntity(null)}
          />
        )}
      </div>
    </div>
      </SemanticOutputProvider>
    </VocabularyContext.Provider>
  )
}
