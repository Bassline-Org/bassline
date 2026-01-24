/**
 * CardSetCard - 3D parallax card for displaying a card set
 *
 * Shows set name, creation date, and card count with depth layers.
 */

import type { CardSet } from '@/types'
import { ParallaxCard } from './ParallaxCard'
import { CardBox, CardBoxVariant } from './CardBox'
import { Layers } from 'lucide-react'

export interface CardSetCardProps {
  set: CardSet
  onClick: () => void
  /** CardBox variant to use (default: 'default') */
  variant?: CardBoxVariant
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function CardSetCard({ set, onClick, variant = 'default' }: CardSetCardProps) {
  const cardCount = set.card_count ?? 0

  return (
    <ParallaxCard onClick={onClick}>
      {/* Background layer: gradient pattern */}
      <div
        className="card-set-pattern"
        style={{ transform: 'translateZ(-20px)' }}
      />

      {/* Middle layer: main content */}
      <div className="relative z-10 h-full" style={{ transform: 'translateZ(0px)' }}>
        <CardBox variant={variant} className="h-full justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1 truncate">
              {set.name}
            </h3>
            <time className="text-xs text-muted-foreground">
              {formatDate(set.created_at)}
            </time>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            <span className="text-sm">
              {cardCount} {cardCount === 1 ? 'card' : 'cards'}
            </span>
          </div>
        </CardBox>
      </div>

      {/* Foreground layer: floating badge */}
      <div
        className="absolute top-3 right-3 z-20"
        style={{ transform: 'translateZ(30px)' }}
      >
        <div className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full shadow-lg">
          {cardCount}
        </div>
      </div>
    </ParallaxCard>
  )
}

export default CardSetCard
