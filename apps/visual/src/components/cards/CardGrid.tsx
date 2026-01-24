/**
 * CardGrid - Responsive grid layout for individual cards
 *
 * Uses CardRenderer to support multiple display modes.
 * Features staggered entrance animations via framer-motion.
 */

import type { Card, CardDisplayMode, CardDensity } from '@/types'
import { motion } from 'framer-motion'
import { CardRenderer } from './CardRenderer'
import { CardBoxVariant } from './CardBox'
import { useCardViewOptional } from './CardViewProvider'
import { cn } from '@/lib/utils'
import { timing, easing } from '@/lib/motion'

export interface CardGridProps {
  cards: Card[]
  onSelectCard: (cardId: string) => void
  /** CardBox variant for all cards (default: from context) */
  variant?: CardBoxVariant
  /** Override display mode for all cards */
  displayMode?: CardDisplayMode
}

// Grid configurations per display mode
const GRID_CLASSES: Record<CardDisplayMode, string> = {
  code: 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5',
  art: 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5',
  text: 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5',
  minimal: 'flex flex-col gap-2',
}

// Density adjustments
const DENSITY_GAP: Record<CardDensity, string> = {
  compact: 'gap-3',
  default: 'gap-5',
  spacious: 'gap-8',
}

// Stagger container variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
}

// Item variants for stagger effect
const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: timing.normal,
      ease: easing.easeOut,
    },
  },
}

export function CardGrid({ cards, onSelectCard, variant, displayMode }: CardGridProps) {
  const { config } = useCardViewOptional()
  const mode = displayMode ?? config.defaultDisplayMode

  if (cards.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-16 text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: timing.normal }}
      >
        <p className="text-muted-foreground text-lg mb-2">No cards in this set</p>
        <p className="text-muted-foreground/70 text-sm">
          Add cards to this set to see them here
        </p>
      </motion.div>
    )
  }

  // Build grid class based on mode and density
  const baseGridClass = GRID_CLASSES[mode]
  const densityClass = DENSITY_GAP[config.density]

  return (
    <motion.div
      className={cn(baseGridClass, densityClass)}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {cards.map((card) => (
        <motion.div key={card.id} variants={itemVariants}>
          <CardRenderer
            card={card}
            onClick={() => onSelectCard(card.id)}
            displayMode={mode}
            boxVariant={variant}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}

export default CardGrid
