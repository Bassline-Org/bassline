/**
 * CardPreviewModal - Modal overlay for viewing full card source
 */

import type { Card } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { useState, useCallback } from 'react'

export interface CardPreviewModalProps {
  card: Card | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CardPreviewModal({
  card,
  open,
  onOpenChange,
}: CardPreviewModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!card) return
    try {
      await navigator.clipboard.writeText(card.source)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [card])

  if (!card) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="font-mono text-base">
              Card v{card.head_version}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="ml-1.5 text-xs">
                {copied ? 'Copied' : 'Copy'}
              </span>
            </Button>
          </div>
          <DialogDescription className="text-xs">
            Created {formatDate(card.created_at)}
            {card.set_id && ` | Set: ${card.set_id.slice(0, 8)}...`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
          <pre className="bg-muted/50 rounded-lg p-4 font-mono text-sm leading-relaxed overflow-x-auto">
            <code>{card.source}</code>
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default CardPreviewModal
