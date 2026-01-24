/**
 * VocabDistributionBar - Shows category breakdown as colored segments
 *
 * Displays a horizontal bar showing the proportion of each vocabulary
 * category in a card set.
 */

import type { CardCategory } from '@/lib/cards/categoryColors'
import { CATEGORY_COLORS } from '@/lib/cards/categoryColors'
import { cn } from '@/lib/utils'

export interface VocabDistribution {
  category: CardCategory
  count: number
  percentage: number
}

export interface VocabDistributionBarProps {
  distribution: VocabDistribution[]
  className?: string
}

export function VocabDistributionBar({
  distribution,
  className,
}: VocabDistributionBarProps) {
  if (!distribution.length) return null

  // Sort by percentage descending
  const sorted = [...distribution].sort((a, b) => b.percentage - a.percentage)

  return (
    <div className={cn('vocab-distribution', className)}>
      {sorted.map(({ category, percentage }) => (
        <div
          key={category}
          className="vocab-distribution__segment"
          style={{
            width: `${percentage}%`,
            backgroundColor: CATEGORY_COLORS[category].hex,
          }}
          title={`${CATEGORY_COLORS[category].name}: ${Math.round(percentage)}%`}
        />
      ))}
    </div>
  )
}

/**
 * Calculate vocab distribution from an array of primary categories
 */
export function calculateVocabDistribution(categories: CardCategory[]): VocabDistribution[] {
  if (!categories.length) return []

  const counts: Partial<Record<CardCategory, number>> = {}

  for (const cat of categories) {
    counts[cat] = (counts[cat] || 0) + 1
  }

  const total = categories.length

  return Object.entries(counts).map(([category, count]) => ({
    category: category as CardCategory,
    count: count!,
    percentage: (count! / total) * 100,
  }))
}

export default VocabDistributionBar
