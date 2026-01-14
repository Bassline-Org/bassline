import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export type DeleteContainerAction = 'delete-all' | 'delete-container-only' | 'cancel'

interface DeleteContainerDialogProps {
  open: boolean
  childCount: number
  containerName: string
  onAction: (action: DeleteContainerAction) => void
}

export function DeleteContainerDialog({
  open,
  childCount,
  containerName,
  onAction,
}: DeleteContainerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onAction('cancel')}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Container
          </DialogTitle>
          <DialogDescription>
            "{containerName}" contains {childCount} {childCount === 1 ? 'item' : 'items'}. How would you like to proceed?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="destructive"
            onClick={() => onAction('delete-all')}
            className="justify-start"
          >
            Delete container and all contents
          </Button>

          <Button
            variant="secondary"
            onClick={() => onAction('delete-container-only')}
            className="justify-start"
          >
            Delete container only (keep contents)
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onAction('cancel')}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
