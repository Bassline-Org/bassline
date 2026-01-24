import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface EditorDialogProps {
  config: { text: string; title?: string }
  onResolve: (result: string | null) => void
}

export function EditorDialog({ config, onResolve }: EditorDialogProps) {
  const [value, setValue] = useState(config.text ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Focus textarea after dialog opens
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
      // Move cursor to end
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleSave = () => {
    onResolve(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
    // Escape to cancel (handled by dialog's onOpenChange)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onResolve(null)}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{config.title ?? 'Edit'}</DialogTitle>
        </DialogHeader>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[300px] font-mono text-sm"
          placeholder="Enter text..."
        />
        <DialogFooter>
          <span className="text-xs text-muted-foreground mr-auto">
            Ctrl+Enter to save
          </span>
          <Button variant="ghost" onClick={() => onResolve(null)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
