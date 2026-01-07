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
import { Plus, Trash2, Maximize, Stamp, Save, FolderInput, FolderOutput } from 'lucide-react'
import type { EntityWithAttrs, StampWithAttrs } from '../types'

interface CanvasContextMenuProps {
  children: React.ReactNode
  entities: EntityWithAttrs[]
  stamps: StampWithAttrs[]
  selectedEntityId: string | null
  selectedEntityParentId: string | null
  onAddEntity: (x: number, y: number) => void
  onDeleteEntity?: () => void
  onFitView: () => void
  onSaveAsStamp: (entityId: string, stampName: string) => void
  onApplyStamp: (stampId: string, entityId: string) => void
  onSetParent: (parentId: string) => void
  onRemoveFromParent: () => void
}

export function CanvasContextMenu({
  children,
  entities,
  stamps,
  selectedEntityId,
  selectedEntityParentId,
  onAddEntity,
  onDeleteEntity,
  onFitView,
  onSaveAsStamp,
  onApplyStamp,
  onSetParent,
  onRemoveFromParent,
}: CanvasContextMenuProps) {
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

  const hasSelection = selectedEntityId !== null

  // Get potential parent entities (all entities except the selected one and its current children)
  const potentialParents = entities.filter((e) => e.id !== selectedEntityId)

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

              {/* Containment options */}
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

              {onDeleteEntity && (
                <ContextMenuItem onClick={onDeleteEntity}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              )}
            </>
          ) : (
            <>
              <ContextMenuItem onClick={handleAddEntity}>
                <Plus className="mr-2 h-4 w-4" />
                Add entity
              </ContextMenuItem>
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
