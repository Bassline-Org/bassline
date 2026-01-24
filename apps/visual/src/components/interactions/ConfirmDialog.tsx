import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  config: { message: string; title?: string }
  onResolve: (result: boolean | null) => void
}

export function ConfirmDialog({ config, onResolve }: ConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onResolve(null)}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{config.title ?? 'Confirm'}</DialogTitle>
          <DialogDescription>{config.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onResolve(false)}>
            No
          </Button>
          <Button onClick={() => onResolve(true)}>Yes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
