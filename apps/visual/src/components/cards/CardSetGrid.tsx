/**
 * CardSetGrid - Responsive grid layout for card sets
 *
 * Uses CardSetRenderer to support multiple display modes.
 * Features staggered entrance animations via framer-motion.
 */

import type { CardSet, CardDisplayMode, CardDensity } from '@/types'
import { motion } from 'framer-motion'
import { CardSetRenderer } from './CardSetRenderer'
import { CardBoxVariant } from './CardBox'
import { useCardViewOptional } from './CardViewProvider'
import { cn } from '@/lib/utils'
import { timing, easing } from '@/lib/motion'

export interface CardSetGridProps {
  sets: CardSet[]
  onSelectSet: (setId: string) => void
  /** CardBox variant for all cards (default: from context) */
  variant?: CardBoxVariant
  /** Override display mode for all sets */
  displayMode?: CardDisplayMode
}

// Grid configurations per display mode
const GRID_CLASSES: Record<CardDisplayMode, string> = {
  code: 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6',
  art: 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6',
  text: 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6',
  minimal: 'flex flex-col gap-2',
}

// Density adjustments
const DENSITY_GAP: Record<CardDensity, string> = {
  compact: 'gap-4',
  default: 'gap-6',
  spacious: 'gap-10',
}

// Stagger container variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

// Item variants for stagger effect
const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: timing.smooth,
      ease: easing.easeOut,
    },
  },
}

export function CardSetGrid({ sets, onSelectSet, variant, displayMode }: CardSetGridProps) {
  const { config } = useCardViewOptional()
  const mode = displayMode ?? config.defaultSetDisplayMode

  if (sets.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-16 text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: timing.normal }}
      >
        <p className="text-muted-foreground text-lg mb-2">No card sets found</p>
        <p className="text-muted-foreground/70 text-sm">
          Create a card set to get started
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
      {sets.map((set) => (
        <motion.div key={set.id} variants={itemVariants}>
          <CardSetRenderer
            set={set}
            onClick={() => onSelectSet(set.id)}
            displayMode={mode}
            boxVariant={variant}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}

export default CardSetGrid
