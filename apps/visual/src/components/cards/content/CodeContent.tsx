/**
 * CodeContent - Code preview display mode
 *
 * Shows source code preview with title extraction (refactored from CardCard).
 */

import type { Card, CardDisplayMeta } from '@/types'
import { Code2 } from 'lucide-react'

export interface CodeContentProps {
  card: Card
  meta?: CardDisplayMeta
}

function getPreviewLines(source: string, maxLines = 8): string {
  const lines = source.split('\n').slice(0, maxLines)
  return lines.join('\n')
}

function getCardTitle(source: string, meta?: CardDisplayMeta): string {
  // Use explicit title if provided
  if (meta?.title) return meta.title

  // Try to extract a meaningful title from the source
  // Look for word definitions like ": word-name" or "in: vocab ;"
  const defMatch = source.match(/^:\s*(\S+)/m)
  if (defMatch) return defMatch[1]

  const vocabMatch = source.match(/^in:\s*(\S+)/m)
  if (vocabMatch) return `${vocabMatch[1]} vocab`

  // Fallback: first few characters
  const firstLine = source.split('\n')[0].trim()
  return firstLine.slice(0, 20) || 'Untitled'
}

export function CodeContent({ card, meta }: CodeContentProps) {
  const preview = getPreviewLines(card.source)
  const title = getCardTitle(card.source, meta)

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Code2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">
          {title}
        </span>
      </div>

      <pre className="card-source-preview flex-1 overflow-hidden">
        {preview}
      </pre>
    </>
  )
}

export default CodeContent
