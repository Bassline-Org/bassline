import { X, Trash2, Package, Ungroup } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EntityWithAttrs } from '../types'
import { attrString } from '../types'

interface MultiSelectPanelProps {
  entities: EntityWithAttrs[]
  hasContainer: boolean
  onDelete: () => void
  onBundle: () => void
  onUnbundle?: () => void
  onClose: () => void
}

export function MultiSelectPanel({
  entities,
  hasContainer,
  onDelete,
  onBundle,
  onUnbundle,
  onClose,
}: MultiSelectPanelProps) {
  return (
    <aside className="w-72 bg-card border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-medium text-sm">
          {entities.length} items selected
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <div className="text-sm text-muted-foreground">
          Selected entities:
        </div>
        <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
          {entities.map((e) => (
            <li key={e.id} className="truncate">
              {attrString(e.attrs.name) || 'Unnamed'}
            </li>
          ))}
        </ul>

        <div className="pt-4 space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={onBundle}
          >
            <Package className="h-4 w-4 mr-2" />
            Bundle into container
          </Button>

          {hasContainer && onUnbundle && (
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={onUnbundle}
            >
              <Ungroup className="h-4 w-4 mr-2" />
              Unbundle container
            </Button>
          )}

          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete all ({entities.length})
          </Button>
        </div>
      </div>
    </aside>
  )
}
