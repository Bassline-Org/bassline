/**
 * DependencyPills - Colored pills for `using:` imports
 */

import type { CardCategory } from '@/lib/cards/categoryColors'
import { CATEGORY_COLORS } from '@/lib/cards/categoryColors'
import { cn } from '@/lib/utils'

// Map known vocabulary names to categories
const VOCAB_TO_CATEGORY: Record<string, CardCategory> = {
  graph: 'graph',
  entities: 'entities',
  ui: 'ui',
  events: 'events',
  cards: 'cards',
  core: 'core',
  meta: 'cards',
  command: 'command',
}

function getVocabCategory(vocab: string): CardCategory {
  const lower = vocab.toLowerCase()
  return VOCAB_TO_CATEGORY[lower] ?? 'core'
}

export interface DependencyPillsProps {
  dependencies: string[]
  maxVisible?: number
  className?: string
}

export function DependencyPills({
  dependencies,
  maxVisible = 3,
  className,
}: DependencyPillsProps) {
  if (!dependencies.length) return null

  const visible = dependencies.slice(0, maxVisible)
  const remaining = dependencies.length - maxVisible

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {visible.map((dep) => {
        const category = getVocabCategory(dep)
        const color = CATEGORY_COLORS[category]

        return (
          <span
            key={dep}
            className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium"
            style={{
              backgroundColor: `color-mix(in srgb, ${color.hex} 15%, transparent)`,
              color: color.hex,
            }}
          >
            {dep}
          </span>
        )
      })}
      {remaining > 0 && (
        <span className="text-[9px] text-zinc-500">
          +{remaining}
        </span>
      )}
    </div>
  )
}

export default DependencyPills
