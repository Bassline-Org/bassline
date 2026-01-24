/**
 * MinimalContent - Compact title + metadata display mode
 *
 * Horizontal row layout for dense card listings.
 */

import type { Card, CardDisplayMeta } from '@/types'
import { Code2, Clock } from 'lucide-react'

export interface MinimalContentProps {
  card: Card
  meta?: CardDisplayMeta
}

function getCardTitle(source: string, meta?: CardDisplayMeta): string {
  if (meta?.title) return meta.title

  const defMatch = source.match(/^:\s*(\S+)/m)
  if (defMatch) return defMatch[1]

  const vocabMatch = source.match(/^in:\s*(\S+)/m)
  if (vocabMatch) return `${vocabMatch[1]} vocab`

  const firstLine = source.split('\n')[0].trim()
  return firstLine.slice(0, 30) || 'Untitled'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function MinimalContent({ card, meta }: MinimalContentProps) {
  const title = getCardTitle(card.source, meta)
  const lineCount = card.source.split('\n').length

  return (
    <div className="h-full flex items-center justify-between gap-4 px-1">
      {/* Left: icon + title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Code2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">
          {title}
        </span>
      </div>

      {/* Right: metadata */}
      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
        {/* Tags (first one only in minimal mode) */}
        {meta?.tags && meta.tags.length > 0 && (
          <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
            {meta.tags[0]}
          </span>
        )}

        {/* Line count */}
        <span className="tabular-nums">{lineCount} lines</span>

        {/* Date */}
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatDate(card.created_at)}</span>
        </div>

        {/* Version badge */}
        <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-medium">
          v{card.head_version}
        </span>
      </div>
    </div>
  )
}

export default MinimalContent
