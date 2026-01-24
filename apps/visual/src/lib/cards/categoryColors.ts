/**
 * Category Colors - Semantic color mappings for card vocabulary domains
 *
 * Each color represents a specific computational domain:
 * - Core: Pure computation, stack operations, math
 * - UI: User interaction (prompt, confirm, edit)
 * - Graph: Graph vocabulary operations
 * - Entities: Entity vocabulary operations
 * - Events: Event emission (emit, trigger, toast)
 * - Cards: Meta-programming, card CRUD
 * - Command: Marked cmd, has keybinding
 */

export type CardCategory =
  | 'core'
  | 'ui'
  | 'graph'
  | 'entities'
  | 'events'
  | 'cards'
  | 'command'

export interface CategoryColor {
  hex: string
  name: string
  description: string
}

export const CATEGORY_COLORS: Record<CardCategory, CategoryColor> = {
  core: {
    hex: '#71717a',
    name: 'Slate',
    description: 'Pure stack ops, math',
  },
  ui: {
    hex: '#f59e0b',
    name: 'Amber',
    description: 'Uses prompt, confirm, edit',
  },
  graph: {
    hex: '#8b5cf6',
    name: 'Violet',
    description: 'Uses graph vocabulary',
  },
  entities: {
    hex: '#06b6d4',
    name: 'Cyan',
    description: 'Uses entities vocabulary',
  },
  events: {
    hex: '#f43f5e',
    name: 'Rose',
    description: 'Uses emit, trigger, toast',
  },
  cards: {
    hex: '#10b981',
    name: 'Emerald',
    description: 'Meta-programming, card CRUD',
  },
  command: {
    hex: '#6366f1',
    name: 'Indigo',
    description: 'Marked cmd, has keybinding',
  },
}

/**
 * CSS variable names for category colors (used in index.css)
 */
export const CATEGORY_CSS_VARS: Record<CardCategory, string> = {
  core: '--category-core',
  ui: '--category-ui',
  graph: '--category-graph',
  entities: '--category-entities',
  events: '--category-events',
  cards: '--category-cards',
  command: '--category-command',
}

/**
 * Get CSS class name for a category
 */
export function getCategoryClass(category: CardCategory): string {
  return `tcg-card--category-${category}`
}

/**
 * Get all category CSS classes for a card with multiple categories
 */
export function getCategoryClasses(categories: CardCategory[]): string[] {
  return categories.map(getCategoryClass)
}
