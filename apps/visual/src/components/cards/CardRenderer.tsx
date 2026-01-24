/**
 * CardRenderer - Dispatches to content components by display mode
 *
 * Uses a registry pattern to render cards with different display modes.
 */

import type { ComponentType } from 'react'
import type { Card, CardDisplayMode, CardDisplayMeta } from '@/types'
import { ParallaxCard } from './ParallaxCard'
import { CardBox, CardBoxVariant } from './CardBox'
import { useCardViewOptional } from './CardViewProvider'
import { CodeContent, ArtContent, TextContent, MinimalContent } from './content'
import { cn } from '@/lib/utils'

export interface ContentProps {
  card: Card
  meta?: CardDisplayMeta
}

// Registry of content components by display mode
const CONTENT_REGISTRY: Record<CardDisplayMode, ComponentType<ContentProps>> = {
  code: CodeContent,
  art: ArtContent,
  text: TextContent,
  minimal: MinimalContent,
}

// Aspect ratio CSS classes per mode
const ASPECT_CLASSES: Record<CardDisplayMode, string> = {
  code: 'parallax-card--code',
  art: 'parallax-card--art',
  text: 'parallax-card--text',
  minimal: 'parallax-card--minimal',
}

export interface CardRendererProps {
  card: Card
  onClick: () => void
  /** Override display mode (otherwise uses meta or context default) */
  displayMode?: CardDisplayMode
  /** Override box variant */
  boxVariant?: CardBoxVariant
  /** Card display metadata */
  meta?: CardDisplayMeta
  /** Additional CSS class */
  className?: string
}

export function CardRenderer({
  card,
  onClick,
  displayMode,
  boxVariant,
  meta,
  className,
}: CardRendererProps) {
  const { config } = useCardViewOptional()

  // Determine display mode: prop > meta > context default
  const mode = displayMode ?? meta?.displayMode ?? config.defaultDisplayMode
  const variant = boxVariant ?? config.boxVariant
  const Content = CONTENT_REGISTRY[mode]
  const aspectClass = ASPECT_CLASSES[mode]

  // For minimal mode, don't wrap in ParallaxCard (simple row layout)
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
        <Content card={card} meta={meta} />
      </div>
    )
  }

  // For art mode, content fills the entire card (no CardBox padding)
  if (mode === 'art') {
    return (
      <ParallaxCard onClick={onClick} className={cn(aspectClass, className)}>
        <div className="relative z-10 h-full w-full">
          <Content card={card} meta={meta} />
        </div>
        {/* Floating version badge */}
        <div
          className="absolute top-2 right-2 z-20"
          style={{ transform: 'translateZ(25px)' }}
        >
          <div className="bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded shadow-md">
            v{card.head_version}
          </div>
        </div>
      </ParallaxCard>
    )
  }

  // Default: code and text modes use CardBox wrapper
  return (
    <ParallaxCard onClick={onClick} className={cn(aspectClass, className)}>
      {/* Background layer for code mode */}
      {mode === 'code' && (
        <div
          className="code-pattern-bg"
          style={{ transform: 'translateZ(-15px)' }}
        />
      )}

      {/* Main content layer */}
      <div className="relative z-10 h-full" style={{ transform: 'translateZ(0px)' }}>
        <CardBox variant={variant} size="sm" className="h-full">
          <Content card={card} meta={meta} />
        </CardBox>
      </div>

      {/* Floating version badge */}
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

export default CardRenderer
