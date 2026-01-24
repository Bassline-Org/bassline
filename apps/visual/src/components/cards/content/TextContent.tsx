/**
 * TextContent - Text/quote focused display mode
 *
 * Description or quote-style presentation with decorative elements.
 */

import type { Card, CardDisplayMeta } from '@/types'
import { Quote } from 'lucide-react'

export interface TextContentProps {
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
  return firstLine.slice(0, 20) || 'Untitled'
}

function getDescription(source: string, meta?: CardDisplayMeta): string {
  if (meta?.description) return meta.description

  // Try to extract a comment or first meaningful line
  const lines = source.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip empty lines and common patterns
    if (!trimmed) continue
    if (trimmed.startsWith(':')) continue
    if (trimmed.startsWith('in:')) continue
    // Found something interesting
    return trimmed.slice(0, 100)
  }

  return source.slice(0, 100)
}

export function TextContent({ card, meta }: TextContentProps) {
  const title = getCardTitle(card.source, meta)
  const description = getDescription(card.source, meta)

  return (
    <div className="h-full flex flex-col justify-center items-center text-center p-4">
      {/* Decorative quote icon */}
      <Quote className="h-8 w-8 text-muted-foreground/30 mb-4 rotate-180" />

      {/* Main description/quote */}
      <p className="text-sm text-foreground/90 leading-relaxed mb-4 line-clamp-4">
        {description}
      </p>

      {/* Title as attribution */}
      <div className="flex items-center gap-2">
        <span className="w-8 h-px bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        <span className="w-8 h-px bg-border" />
      </div>

      {/* Tags */}
      {meta?.tags && meta.tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-4">
          {meta.tags.map((tag) => (
            <span
              key={tag}
              className="bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default TextContent
