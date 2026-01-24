/**
 * CardSetRenderer - Renders card sets with deck stack effect and vocab distribution
 *
 * Features:
 * - Deck stack effect (stacked cards behind)
 * - Vocabulary distribution bar showing category breakdown
 * - Display mode support (code, art, text, minimal)
 */

import type { Card, CardSet, CardDisplayMode } from '@/types'
import { ParallaxCard } from './ParallaxCard'
import { CardBox, CardBoxVariant } from './CardBox'
import { useCardViewOptional } from './CardViewProvider'
import { CardArtwork } from './core/CardArtwork'
import {
  VocabDistributionBar,
  calculateVocabDistribution,
  type VocabDistribution,
} from './badges'
import { parseCardMeta } from '@/lib/cards/parseCardMeta'
import { CATEGORY_COLORS, type CardCategory } from '@/lib/cards/categoryColors'
import { Layers, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

// Aspect ratio CSS classes per mode
const ASPECT_CLASSES: Record<CardDisplayMode, string> = {
  code: 'parallax-card--code',
  art: 'parallax-card--art',
  text: 'parallax-card--text',
  minimal: 'parallax-card--minimal',
}

export interface CardSetRendererProps {
  set: CardSet
  onClick: () => void
  /** Optional cards in this set (for computing vocab distribution) */
  cards?: Card[]
  /** Override display mode */
  displayMode?: CardDisplayMode
  /** Override box variant */
  boxVariant?: CardBoxVariant
  /** Additional CSS class */
  className?: string
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Calculate primary category for each card and determine set's dominant color
 */
function useSetVocabAnalysis(cards?: Card[]): {
  distribution: VocabDistribution[]
  dominantCategory: CardCategory
  dominantColor: string
} {
  return useMemo(() => {
    if (!cards?.length) {
      return {
        distribution: [],
        dominantCategory: 'core' as CardCategory,
        dominantColor: CATEGORY_COLORS.core.hex,
      }
    }

    const categories = cards.map((card) => {
      const meta = parseCardMeta(card.source)
      return meta.primaryCategory
    })

    const distribution = calculateVocabDistribution(categories)

    // Find dominant category (highest count)
    const dominant = distribution.reduce(
      (max, curr) => (curr.count > max.count ? curr : max),
      distribution[0]
    )

    return {
      distribution,
      dominantCategory: dominant.category,
      dominantColor: CATEGORY_COLORS[dominant.category].hex,
    }
  }, [cards])
}

export function CardSetRenderer({
  set,
  onClick,
  cards,
  displayMode,
  boxVariant,
  className,
}: CardSetRendererProps) {
  const { config } = useCardViewOptional()
  const { distribution, dominantColor } = useSetVocabAnalysis(cards)

  const mode = displayMode ?? config.defaultSetDisplayMode
  const variant = boxVariant ?? config.boxVariant
  const cardCount = set.card_count ?? cards?.length ?? 0
  const aspectClass = ASPECT_CLASSES[mode]
  const hasCards = cardCount >= 3

  // Minimal mode: simple row
  if (mode === 'minimal') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'card-box cursor-pointer hover:bg-accent/5 transition-colors',
          aspectClass,
          className
        )}
      >
        <div className="h-full flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {set.name}
            </span>
            {distribution.length > 0 && (
              <VocabDistributionBar
                distribution={distribution}
                className="w-20 flex-shrink-0"
              />
            )}
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted-foreground">
            <span className="tabular-nums">{cardCount} cards</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(set.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Art mode: artwork with overlay and deck stack
  if (mode === 'art') {
    return (
      <ParallaxCard onClick={onClick} className={cn(aspectClass, className)}>
        {/* Deck stack wrapper - outside overflow-hidden to show pseudo-elements */}
        <div
          className={cn(
            'relative z-10 h-full w-full',
            hasCards && 'card-set-stack-wrapper'
          )}
        >
          {/* Inner content with overflow hidden for artwork */}
          <div className="relative h-full w-full overflow-hidden rounded-lg">
            <CardArtwork
              seed={`set-${set.id}`}
              width={300}
              height={400}
              className="absolute inset-0"
              alt={set.name}
            />
            {/* Dominant category tint overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg,
                  color-mix(in srgb, ${dominantColor} 15%, transparent) 0%,
                  transparent 40%,
                  rgba(0,0,0,0.85) 100%)`
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <h3 className="text-lg font-semibold text-white truncate drop-shadow-md">
                {set.name}
              </h3>
              <p className="text-sm text-white/80 mt-1 drop-shadow-sm">
                {cardCount} {cardCount === 1 ? 'card' : 'cards'}
              </p>
              {distribution.length > 0 && (
                <VocabDistributionBar
                  distribution={distribution}
                  className="mt-2"
                />
              )}
            </div>
          </div>
        </div>
        {/* Floating badge */}
        <div
          className="absolute top-3 right-3 z-20"
          style={{ transform: 'translateZ(30px)' }}
        >
          <div
            className="backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full shadow-lg"
            style={{
              backgroundColor: `color-mix(in srgb, ${dominantColor} 60%, black)`,
            }}
          >
            {cardCount}
          </div>
        </div>
      </ParallaxCard>
    )
  }

  // Text mode: centered quote style with deck stack
  if (mode === 'text') {
    return (
      <ParallaxCard onClick={onClick} className={cn(aspectClass, className)}>
        <div
          className={cn(
            'relative z-10 h-full',
            hasCards && 'card-set-stack-wrapper'
          )}
          style={{ transform: 'translateZ(0px)' }}
        >
          <CardBox variant={variant} className="h-full">
            <div className="h-full flex flex-col justify-center items-center text-center p-4">
              <Layers
                className="h-8 w-8 mb-4"
                style={{ color: `color-mix(in srgb, ${dominantColor} 30%, var(--color-fg-muted))` }}
              />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {set.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{cardCount} {cardCount === 1 ? 'card' : 'cards'}</span>
                <span className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
                <span>{formatDate(set.created_at)}</span>
              </div>
              {distribution.length > 0 && (
                <VocabDistributionBar
                  distribution={distribution}
                  className="mt-3 w-full max-w-32"
                />
              )}
            </div>
          </CardBox>
        </div>
      </ParallaxCard>
    )
  }

  // Default (code) mode: gradient background with deck stack
  return (
    <ParallaxCard onClick={onClick} className={cn(aspectClass, className)}>
      {/* Background layer: gradient pattern with dominant color tint */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: `linear-gradient(135deg,
            color-mix(in srgb, ${dominantColor} 10%, var(--theme-card)),
            color-mix(in srgb, ${dominantColor} 5%, var(--theme-card)))`,
          transform: 'translateZ(-20px)',
        }}
      />

      {/* Main content layer with deck stack */}
      <div
        className={cn(
          'relative z-10 h-full',
          hasCards && 'card-set-stack-wrapper'
        )}
        style={{ transform: 'translateZ(0px)' }}
      >
        <CardBox variant={variant} className="h-full justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1 truncate">
              {set.name}
            </h3>
            <time className="text-xs text-muted-foreground">
              {formatDate(set.created_at)}
            </time>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Layers className="h-4 w-4" style={{ color: dominantColor }} />
              <span className="text-sm">
                {cardCount} {cardCount === 1 ? 'card' : 'cards'}
              </span>
            </div>
            {distribution.length > 0 && (
              <VocabDistributionBar distribution={distribution} />
            )}
          </div>
        </CardBox>
      </div>

      {/* Foreground layer: floating badge with dominant color */}
      <div
        className="absolute top-3 right-3 z-20"
        style={{ transform: 'translateZ(30px)' }}
      >
        <div
          className="text-white text-xs font-medium px-2 py-1 rounded-full shadow-lg"
          style={{ backgroundColor: dominantColor }}
        >
          {cardCount}
        </div>
      </div>
    </ParallaxCard>
  )
}

export default CardSetRenderer
