import { useLoaderData, useFetcher, Link } from 'react-router'
import { useCallback, useState, useEffect, useRef } from 'react'
import { ArrowLeft, Settings, Stamp } from 'lucide-react'
import type { EditorLoaderData, EntityWithAttrs } from '../types'
import { Canvas } from '../components/Canvas'
import { PropertyPanel } from '../components/PropertyPanel'
import { StampsPanel } from '../components/StampsPanel'
import { Button } from '@/components/ui/button'
import { useVocabulary } from '../hooks/useVocabulary'

export function Editor() {
  const { project, entities: loadedEntities, relationships, stamps, uiState } = useLoaderData() as EditorLoaderData
  const fetcher = useFetcher()

  // Local state for entities (allows optimistic updates without full revalidation)
  const [entities, setEntities] = useState<EntityWithAttrs[]>(loadedEntities)

  // Local selection state - NOT persisted to DB
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)

  // Stamps panel visibility
  const [stampsPanelOpen, setStampsPanelOpen] = useState(false)

  // Parse vocabulary from stamps
  const vocabulary = useVocabulary(stamps)

  // Track loaded entities to detect changes from loader (create/delete)
  const prevLoadedEntitiesRef = useRef(loadedEntities)
  useEffect(() => {
    // Only sync when loader data actually changes (structural changes like create/delete)
    if (prevLoadedEntitiesRef.current !== loadedEntities) {
      prevLoadedEntitiesRef.current = loadedEntities
      setEntities(loadedEntities)
    }
  }, [loadedEntities])

  const selectedEntity = entities.find((e) => e.id === selectedEntityId)

  const handleCreateEntity = useCallback(
    (x: number, y: number) => {
      const name = `Entity ${entities.length + 1}`
      // Use form action for structural changes - triggers revalidation
      fetcher.submit(
        { intent: 'createEntity', name, x: x.toString(), y: y.toString() },
        { method: 'post' }
      )
    },
    [fetcher, entities.length]
  )

  const handleMoveEntity = useCallback(
    async (entityId: string, x: number, y: number) => {
      // Direct DB call - NO revalidation needed, React Flow already shows correct position
      await window.db.attrs.setBatch(entityId, {
        x: Math.round(x).toString(),
        y: Math.round(y).toString()
      })
      // Update local state to keep in sync
      setEntities(prev => prev.map(e =>
        e.id === entityId
          ? { ...e, attrs: { ...e.attrs, x: Math.round(x).toString(), y: Math.round(y).toString() } }
          : e
      ))
    },
    []
  )

  const handleResizeEntity = useCallback(
    async (entityId: string, width: number, height: number) => {
      // Direct DB call - NO revalidation needed
      await window.db.attrs.setBatch(entityId, {
        'ui.width': Math.round(width).toString(),
        'ui.height': Math.round(height).toString()
      })
      // Update local state to keep in sync
      setEntities(prev => prev.map(e =>
        e.id === entityId
          ? { ...e, attrs: { ...e.attrs, 'ui.width': Math.round(width).toString(), 'ui.height': Math.round(height).toString() } }
          : e
      ))
    },
    []
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
      fetcher.submit(
        { intent: 'createRelationship', from, to, kind: 'connects' },
        { method: 'post' }
      )
    },
    [fetcher]
  )

  const handleDeleteEntity = useCallback(
    (entityId: string) => {
      // Clear selection if deleting selected entity
      if (selectedEntityId === entityId) {
        setSelectedEntityId(null)
      }
      // Form action for structural change - triggers revalidation
      fetcher.submit({ intent: 'deleteEntity', entityId }, { method: 'post' })
    },
    [fetcher, selectedEntityId]
  )

  const handleViewportChange = useCallback(
    async (x: number, y: number, zoom: number) => {
      // Direct DB call - no revalidation needed
      await window.db.uiState.update(project.id, {
        viewport_x: x,
        viewport_y: y,
        viewport_zoom: zoom
      })
    },
    [project.id]
  )

  const handleUpdateAttr = useCallback(
    async (entityId: string, key: string, value: string) => {
      // Direct DB call - no revalidation
      await window.db.attrs.set(entityId, key, value)
      // Update local state
      setEntities(prev => prev.map(e =>
        e.id === entityId
          ? { ...e, attrs: { ...e.attrs, [key]: value } }
          : e
      ))
    },
    []
  )

  const handleDeleteAttr = useCallback(
    async (entityId: string, key: string) => {
      // Direct DB call - no revalidation
      await window.db.attrs.delete(entityId, key)
      // Update local state
      setEntities(prev => prev.map(e => {
        if (e.id !== entityId) return e
        const { [key]: _, ...restAttrs } = e.attrs
        return { ...e, attrs: restAttrs }
      }))
    },
    []
  )

  const handleSaveAsStamp = useCallback(
    (entityId: string, stampName: string) => {
      fetcher.submit(
        { intent: 'createStamp', sourceEntityId: entityId, stampName },
        { method: 'post' }
      )
    },
    [fetcher]
  )

  const handleApplyStamp = useCallback(
    (stampId: string, entityId: string) => {
      // Use fetcher for structural change - triggers revalidation
      // This ensures new child entities are loaded after stamp application
      fetcher.submit(
        { intent: 'applyStamp', stampId, targetEntityId: entityId },
        { method: 'post' }
      )
    },
    [fetcher]
  )

  const handleContain = useCallback(
    (parentId: string, childId: string) => {
      fetcher.submit(
        { intent: 'contain', parentId, childId },
        { method: 'post' }
      )
    },
    [fetcher]
  )

  const handleUncontain = useCallback(
    (childId: string) => {
      fetcher.submit(
        { intent: 'uncontain', childId },
        { method: 'post' }
      )
    },
    [fetcher]
  )

  const handleDeleteRelationship = useCallback(
    (relationshipId: string) => {
      fetcher.submit(
        { intent: 'deleteRelationship', relationshipId },
        { method: 'post' }
      )
    },
    [fetcher]
  )

  const handleDeleteStamp = useCallback(
    (stampId: string) => {
      fetcher.submit(
        { intent: 'deleteStamp', stampId },
        { method: 'post' }
      )
    },
    [fetcher]
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
