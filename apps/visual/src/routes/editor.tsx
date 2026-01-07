import { useLoaderData, Link } from 'react-router'
import { useCallback, useState } from 'react'
import { ArrowLeft, Settings, Stamp } from 'lucide-react'
import type { EditorLoaderData } from '../types'
import { Canvas } from '../components/Canvas'
import { PropertyPanel } from '../components/PropertyPanel'
import { StampsPanel } from '../components/StampsPanel'
import { Button } from '@/components/ui/button'
import { useVocabulary } from '../hooks/useVocabulary'
import { useCommands } from '../hooks/useCommands'
import {
  SetAttrCommand,
  SetAttrBatchCommand,
  DeleteAttrCommand,
  CreateEntityCommand,
  DeleteEntityCommand,
  CreateRelationshipCommand,
  DeleteRelationshipCommand,
  ContainCommand,
  UncontainCommand,
  CreateStampCommand,
  ApplyStampCommand,
  DeleteStampCommand,
  ViewportChangeCommand,
} from '../lib/commands'

export function Editor() {
  const { project, entities, relationships, stamps, uiState } = useLoaderData() as EditorLoaderData
  const { execute } = useCommands()

  // Local selection state - NOT persisted to DB
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)

  // Stamps panel visibility
  const [stampsPanelOpen, setStampsPanelOpen] = useState(false)

  // Parse vocabulary from stamps
  const vocabulary = useVocabulary(stamps)

  const selectedEntity = entities.find((e) => e.id === selectedEntityId)

  const handleCreateEntity = useCallback(
    (x: number, y: number) => {
      const name = `Entity ${entities.length + 1}`
      execute(new CreateEntityCommand(project.id, {
        name,
        x: Math.round(x).toString(),
        y: Math.round(y).toString(),
      }))
    },
    [execute, entities.length, project.id]
  )

  const handleMoveEntity = useCallback(
    (entityId: string, x: number, y: number) => {
      // SetAttrBatchCommand is undoable and triggers revalidation
      execute(new SetAttrBatchCommand(entityId, {
        x: Math.round(x).toString(),
        y: Math.round(y).toString(),
      }))
    },
    [execute]
  )

  const handleResizeEntity = useCallback(
    (entityId: string, width: number, height: number) => {
      execute(new SetAttrBatchCommand(entityId, {
        'ui.width': Math.round(width).toString(),
        'ui.height': Math.round(height).toString(),
      }))
    },
    [execute]
  )

  const handleSelectEntity = useCallback(
    (entityId: string | null) => {
      // Local state only - no DB persistence needed for selection
      setSelectedEntityId(entityId)
    },
    []
  )

  const handleConnect = useCallback(
    (from: string, to: string) => {
      execute(new CreateRelationshipCommand(project.id, {
        from_entity: from,
        to_entity: to,
        kind: 'connects',
      }))
    },
    [execute, project.id]
  )

  const handleDeleteEntity = useCallback(
    (entityId: string) => {
      // Clear selection if deleting selected entity
      if (selectedEntityId === entityId) {
        setSelectedEntityId(null)
      }
      execute(new DeleteEntityCommand(entityId))
    },
    [execute, selectedEntityId]
  )

  const handleViewportChange = useCallback(
    (x: number, y: number, zoom: number) => {
      // ViewportChangeCommand is not undoable - UI state is ephemeral
      execute(new ViewportChangeCommand(project.id, { x, y, zoom }))
    },
    [execute, project.id]
  )

  const handleUpdateAttr = useCallback(
    (entityId: string, key: string, value: string) => {
      execute(new SetAttrCommand(entityId, key, value))
    },
    [execute]
  )

  const handleDeleteAttr = useCallback(
    (entityId: string, key: string) => {
      execute(new DeleteAttrCommand(entityId, key))
    },
    [execute]
  )

  const handleSaveAsStamp = useCallback(
    (entityId: string, stampName: string) => {
      execute(new CreateStampCommand(entityId, stampName))
    },
    [execute]
  )

  const handleApplyStamp = useCallback(
    (stampId: string, entityId: string) => {
      execute(new ApplyStampCommand(stampId, entityId))
    },
    [execute]
  )

  const handleContain = useCallback(
    (parentId: string, childId: string) => {
      execute(new ContainCommand(project.id, parentId, childId))
    },
    [execute, project.id]
  )

  const handleUncontain = useCallback(
    (childId: string) => {
      execute(new UncontainCommand(project.id, childId))
    },
    [execute, project.id]
  )

  const handleDeleteRelationship = useCallback(
    (relationshipId: string) => {
      execute(new DeleteRelationshipCommand(relationshipId))
    },
    [execute]
  )

  const handleDeleteStamp = useCallback(
    (stampId: string) => {
      execute(new DeleteStampCommand(stampId))
    },
    [execute]
  )

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 bg-card border-b border-border">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Projects
          </Link>
        </Button>
        <h1 className="text-base font-medium">{project.name}</h1>
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
            selectedEntityId={selectedEntityId}
            uiState={uiState}
            onCreateEntity={handleCreateEntity}
            onMoveEntity={handleMoveEntity}
            onResizeEntity={handleResizeEntity}
            onSelectEntity={handleSelectEntity}
            onDeleteEntity={handleDeleteEntity}
            onDeleteRelationship={handleDeleteRelationship}
            onConnect={handleConnect}
            onContain={handleContain}
            onUncontain={handleUncontain}
            onViewportChange={handleViewportChange}
            onSaveAsStamp={handleSaveAsStamp}
            onApplyStamp={handleApplyStamp}
          />
        </div>

        {selectedEntity && (
          <PropertyPanel
            entity={selectedEntity}
            vocabulary={vocabulary}
            onUpdateAttr={(key, value) => handleUpdateAttr(selectedEntity.id, key, value)}
            onDeleteAttr={(key) => handleDeleteAttr(selectedEntity.id, key)}
            onDelete={() => handleDeleteEntity(selectedEntity.id)}
            onClose={() => handleSelectEntity(null)}
          />
        )}
      </div>
    </div>
  )
}
