/**
 * CardCard - 3D parallax card for displaying an individual card
 *
 * Shows source code preview with version badge and depth layers.
 */

import type { Card } from '@/types'
import { ParallaxCard } from './ParallaxCard'
import { CardBox, CardBoxVariant } from './CardBox'
import { Code2 } from 'lucide-react'

export interface CardCardProps {
  card: Card
  onClick: () => void
  /** CardBox variant to use (default: 'glass') */
  variant?: CardBoxVariant
}

function getPreviewLines(source: string, maxLines = 8): string {
  const lines = source.split('\n').slice(0, maxLines)
  return lines.join('\n')
}

function getCardTitle(source: string): string {
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

export function CardCard({ card, onClick, variant = 'glass' }: CardCardProps) {
  const preview = getPreviewLines(card.source)
  const title = getCardTitle(card.source)

  return (
    <ParallaxCard onClick={onClick}>
      {/* Background layer: code pattern */}
      <div
        className="code-pattern-bg"
        style={{ transform: 'translateZ(-15px)' }}
      />

      {/* Middle layer: source preview */}
      <div className="relative z-10 h-full" style={{ transform: 'translateZ(0px)' }}>
        <CardBox variant={variant} size="sm" className="h-full">
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {title}
            </span>
          </div>

          <pre className="card-source-preview flex-1 overflow-hidden">
            {preview}
          </pre>
        </CardBox>
      </div>

      {/* Foreground layer: version badge */}
      <div
        className="absolute top-2 right-2 z-20"
        style={{ transform: 'translateZ(25px)' }}
      >
        <div className="bg-secondary text-secondary-foreground text-xs font-medium px-2 py-0.5 rounded shadow-md">
          v{card.head_version}
        </div>
      </div>
    </ParallaxCard>
  )
}

export default CardCard
