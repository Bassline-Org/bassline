import { useCallback, useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Maximize, Stamp, Save, FolderInput, FolderOutput, Package, Ungroup, Sparkles } from 'lucide-react'
import type { EntityWithAttrs, StampWithAttrs } from '../types'
import { getAllSemantics } from '../lib/semantics'

interface CanvasContextMenuProps {
  children: React.ReactNode
  entities: EntityWithAttrs[]
  stamps: StampWithAttrs[]
  selectedEntityIds: Set<string>
  selectedEntityParentId: string | null
  isSelectedContainer: boolean
  onAddEntity: (x: number, y: number) => void
  onAddSemantic: (x: number, y: number, semanticType: string) => void
  onDeleteEntity?: () => void
  onFitView: () => void
  onSaveAsStamp: (entityId: string, stampName: string) => void
  onApplyStamp: (stampId: string, entityId: string) => void
  onSetParent: (parentId: string) => void
  onRemoveFromParent: () => void
  onBundle?: () => void
  onUnbundle?: () => void
}

export function CanvasContextMenu({
  children,
  entities,
  stamps,
  selectedEntityIds,
  selectedEntityParentId,
  isSelectedContainer,
  onAddEntity,
  onAddSemantic,
  onDeleteEntity,
  onFitView,
  onSaveAsStamp,
  onApplyStamp,
  onSetParent,
  onRemoveFromParent,
  onBundle,
  onUnbundle,
}: CanvasContextMenuProps) {
  // Derive single selection for backwards compat
  const selectedEntityId = selectedEntityIds.size === 1 ? [...selectedEntityIds][0] : null
  const [contextPosition, setContextPosition] = useState<{ x: number; y: number } | null>(null)
  const [stampDialogOpen, setStampDialogOpen] = useState(false)
  const [stampName, setStampName] = useState('')

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    setContextPosition({ x: e.clientX, y: e.clientY })
  }, [])

  const handleAddEntity = useCallback(() => {
    if (contextPosition) {
      onAddEntity(contextPosition.x, contextPosition.y)
    }
  }, [contextPosition, onAddEntity])

  const handleAddSemantic = useCallback((semanticType: string) => {
    if (contextPosition) {
      onAddSemantic(contextPosition.x, contextPosition.y, semanticType)
    }
  }, [contextPosition, onAddSemantic])

  const handleSaveAsStampClick = useCallback(() => {
    setStampName('')
    setStampDialogOpen(true)
  }, [])

  const handleSaveStamp = useCallback(() => {
    if (selectedEntityId && stampName.trim()) {
      onSaveAsStamp(selectedEntityId, stampName.trim())
      setStampDialogOpen(false)
      setStampName('')
    }
  }, [selectedEntityId, stampName, onSaveAsStamp])

  const handleApplyStamp = useCallback(
    (stampId: string) => {
      if (selectedEntityId) {
        onApplyStamp(stampId, selectedEntityId)
      }
    },
    [selectedEntityId, onApplyStamp]
  )

  const hasSelection = selectedEntityIds.size > 0
  const hasSingleSelection = selectedEntityId !== null
  const hasMultiSelection = selectedEntityIds.size > 1

  // Get potential parent entities (all entities except the selected ones)
  const potentialParents = entities.filter((e) => !selectedEntityIds.has(e.id))

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="w-full h-full" onContextMenu={handleContextMenu}>
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {hasSelection ? (
            <>
              {/* Multi-selection: bundle action */}
              {hasMultiSelection && onBundle && (
                <>
                  <ContextMenuItem onClick={onBundle}>
                    <Package className="mr-2 h-4 w-4" />
                    Bundle ({selectedEntityIds.size} items)
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}

              {/* Single selection: unbundle if container */}
              {hasSingleSelection && isSelectedContainer && onUnbundle && (
                <>
                  <ContextMenuItem onClick={onUnbundle}>
                    <Ungroup className="mr-2 h-4 w-4" />
                    Unbundle
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}

              {/* Stamp options - single selection only */}
              {hasSingleSelection && (
                <>
                  {stamps.length > 0 && (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Stamp className="mr-2 h-4 w-4" />
                        Stamp as...
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {stamps.map((stamp) => (
                          <ContextMenuItem
                            key={stamp.id}
                            onClick={() => handleApplyStamp(stamp.id)}
                          >
                            {stamp.name || 'Unnamed'}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  )}
                  <ContextMenuItem onClick={handleSaveAsStampClick}>
                    <Save className="mr-2 h-4 w-4" />
                    Save as stamp...
                  </ContextMenuItem>
                  <ContextMenuSeparator />

                  {/* Containment options - single selection */}
                  {potentialParents.length > 0 && (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <FolderInput className="mr-2 h-4 w-4" />
                        Move into...
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {potentialParents.map((entity) => (
                          <ContextMenuItem
                            key={entity.id}
                            onClick={() => onSetParent(entity.id)}
                          >
                            {entity.attrs.name || 'Unnamed'}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  )}
                  {selectedEntityParentId && (
                    <ContextMenuItem onClick={onRemoveFromParent}>
                      <FolderOutput className="mr-2 h-4 w-4" />
                      Remove from parent
                    </ContextMenuItem>
                  )}
                  <ContextMenuSeparator />
                </>
              )}

              {onDeleteEntity && (
                <ContextMenuItem onClick={onDeleteEntity}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete{hasMultiSelection ? ` (${selectedEntityIds.size})` : ''}
                </ContextMenuItem>
              )}
            </>
          ) : (
            <>
              <ContextMenuItem onClick={handleAddEntity}>
                <Plus className="mr-2 h-4 w-4" />
                Add entity
              </ContextMenuItem>
              {getAllSemantics().length > 0 && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Add semantic
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    {getAllSemantics().map((semantic) => (
                      <ContextMenuItem
                        key={semantic.id}
                        onClick={() => handleAddSemantic(semantic.id)}
                      >
                        {semantic.name}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={onFitView}>
            <Maximize className="mr-2 h-4 w-4" />
            Fit view
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={stampDialogOpen} onOpenChange={setStampDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Save as Stamp</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Stamp name"
              value={stampName}
              onChange={(e) => setStampName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveStamp()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStampDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStamp} disabled={!stampName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
