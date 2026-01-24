/**
 * CardCategoryBadge - Icon + color badge for primary card category
 */

import {
  Calculator,
  MousePointerClick,
  GitBranch,
  Database,
  Zap,
  Layers,
  Terminal,
} from 'lucide-react'
import type { CardCategory } from '@/lib/cards/categoryColors'
import { CATEGORY_COLORS } from '@/lib/cards/categoryColors'
import { cn } from '@/lib/utils'

const CATEGORY_ICONS: Record<CardCategory, React.ComponentType<{ className?: string }>> = {
  core: Calculator,
  ui: MousePointerClick,
  graph: GitBranch,
  entities: Database,
  events: Zap,
  cards: Layers,
  command: Terminal,
}

const CATEGORY_LABELS: Record<CardCategory, string> = {
  core: 'Core',
  ui: 'UI',
  graph: 'Graph',
  entities: 'Entities',
  events: 'Events',
  cards: 'Cards',
  command: 'Command',
}

export interface CardCategoryBadgeProps {
  category: CardCategory
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function CardCategoryBadge({
  category,
  showLabel = false,
  size = 'sm',
  className,
}: CardCategoryBadgeProps) {
  const Icon = CATEGORY_ICONS[category]
  const color = CATEGORY_COLORS[category]
  const label = CATEGORY_LABELS[category]

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const paddingSize = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-xs'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        paddingSize,
        textSize,
        className
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color.hex} 20%, transparent)`,
        color: color.hex,
      }}
      title={color.description}
    >
      <Icon className={iconSize} />
      {showLabel && <span>{label}</span>}
    </div>
  )
}

export default CardCategoryBadge
