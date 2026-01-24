/**
 * parseCardMeta - Extract semantic information from Borth card source
 *
 * Parses card source to determine:
 * - Word name, vocab name, dependencies
 * - Whether it's private, a command, blocking
 * - What vocabularies it uses (graph, entities, ui, events, cards)
 * - Keybinding if present
 * - Documentation string
 * - Complexity score
 */

import type { CardCategory } from './categoryColors'

export interface ParsedCardMeta {
  /** Word name from `: word-name` */
  wordName: string | null
  /** Vocab name from `in: vocab-name` */
  vocabName: string | null
  /** Dependencies from `using: x y z ;` */
  dependencies: string[]
  /** Private word (`:_` prefix) */
  isPrivate: boolean
  /** Has `cmd` marker */
  isCommand: boolean
  /** Keybinding from `key: cmd+k` */
  keybinding: string | null
  /** Documentation from `doc{ ... }` or `( ... )` comment */
  docString: string | null
  /** Uses blocking UI words (prompt, confirm, edit) */
  isBlocking: boolean
  /** Uses graph vocabulary words */
  hasGraphOps: boolean
  /** Uses entity vocabulary words */
  hasEntityOps: boolean
  /** Uses event emission words (emit, trigger, toast) */
  hasEventEmission: boolean
  /** Uses card/meta-programming words */
  hasCardOps: boolean
  /** Uses UI vocabulary words */
  hasUIWords: boolean
  /** Primary computed category */
  primaryCategory: CardCategory
  /** All categories this card belongs to */
  categories: CardCategory[]
  /** Complexity score based on lines, dependencies */
  complexityScore: number
  /** Line count of meaningful code */
  lineCount: number
  /** Complexity tier: simple, medium, complex */
  complexityTier: 'simple' | 'medium' | 'complex'
}

// Vocabulary word patterns for detection
const GRAPH_WORDS = [
  'node', 'edge', 'connect', 'disconnect', 'neighbors', 'path',
  'traverse', 'bfs', 'dfs', 'graph', 'topology', 'degree',
  'adjacent', 'reachable', 'cycle', 'tree', 'forest',
]

const ENTITY_WORDS = [
  'entity', 'entities', 'attr', 'attrs', 'get-attr', 'set-attr',
  'create-entity', 'delete-entity', 'find-entities', 'query',
  'relationship', 'relate', 'unrelate',
]

const UI_WORDS = [
  'prompt', 'confirm', 'edit', 'dialog', 'modal', 'input',
  'select', 'menu', 'toast', 'notify', 'alert',
]

const EVENT_WORDS = [
  'emit', 'trigger', 'on', 'every', 'subscribe', 'publish',
  'event', 'listen', 'handler', 'dispatch',
]

const CARD_WORDS = [
  'card', 'cards', 'set', 'sets', 'create-card', 'delete-card',
  'update-card', 'load-card', 'save-card', 'eval-card',
  'define', 'vocabulary', 'vocab',
]

const BLOCKING_WORDS = ['prompt', 'confirm', 'edit', 'input', 'dialog', 'modal']

/**
 * Check if source contains any word from a list (case-insensitive, word-boundary aware)
 */
function containsWords(source: string, words: string[]): boolean {
  const lowerSource = source.toLowerCase()
  return words.some(word => {
    // Match word boundary - preceded/followed by non-word chars
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    return regex.test(lowerSource)
  })
}

/**
 * Extract word name from `: word-name` or `:_ private-name` definition
 */
function extractWordName(source: string): { name: string | null; isPrivate: boolean } {
  // Match `:_` for private or `:` for public word definitions
  const match = source.match(/^:(_)?(\S+)/m)
  if (match) {
    return {
      name: match[2],
      isPrivate: match[1] === '_',
    }
  }
  return { name: null, isPrivate: false }
}

/**
 * Extract vocab name from `in: vocab-name`
 */
function extractVocabName(source: string): string | null {
  const match = source.match(/^in:\s*(\S+)/m)
  return match ? match[1] : null
}

/**
 * Extract dependencies from `using: dep1 dep2 dep3 ;`
 */
function extractDependencies(source: string): string[] {
  const match = source.match(/^using:\s*([^;]+);/m)
  if (!match) return []
  return match[1].trim().split(/\s+/).filter(Boolean)
}

/**
 * Extract keybinding from `key: cmd+k` or `key: ctrl+shift+n`
 */
function extractKeybinding(source: string): string | null {
  const match = source.match(/^key:\s*(\S+)/m)
  return match ? match[1] : null
}

/**
 * Extract documentation from `doc{ ... }` block or `( ... )` comment
 */
function extractDocString(source: string): string | null {
  // First try doc{ ... } block
  const docBlockMatch = source.match(/doc\{\s*([\s\S]*?)\s*\}/)
  if (docBlockMatch) {
    return docBlockMatch[1].trim()
  }

  // Fall back to ( ... ) comment at start
  const parenMatch = source.match(/^\s*\(\s*([^)]+)\s*\)/m)
  if (parenMatch) {
    return parenMatch[1].trim()
  }

  // Try \ line comment
  const lineMatch = source.match(/^\s*\\\s*(.+)$/m)
  if (lineMatch) {
    return lineMatch[1].trim()
  }

  return null
}

/**
 * Check if source has `cmd` marker
 */
function hasCommandMarker(source: string): boolean {
  // Look for `cmd` as a standalone word or marker
  return /\bcmd\b/.test(source)
}

/**
 * Calculate complexity score and tier
 */
function calculateComplexity(source: string, dependencies: string[]): {
  score: number
  lineCount: number
  tier: 'simple' | 'medium' | 'complex'
} {
  const meaningfulLines = source.split('\n').filter(line => {
    const trimmed = line.trim()
    return trimmed && !trimmed.startsWith('\\') && !trimmed.startsWith('(')
  })
  const lineCount = meaningfulLines.length
  const depCount = dependencies.length

  // Score: lines + (deps * 2)
  const score = lineCount + (depCount * 2)

  let tier: 'simple' | 'medium' | 'complex'
  if (lineCount < 5) {
    tier = 'simple'
  } else if (lineCount <= 20) {
    tier = 'medium'
  } else {
    tier = 'complex'
  }

  return { score, lineCount, tier }
}

/**
 * Determine primary category based on detected features
 * Priority order: command > cards > ui > events > graph > entities > core
 */
function determinePrimaryCategory(meta: Partial<ParsedCardMeta>): CardCategory {
  if (meta.isCommand) return 'command'
  if (meta.hasCardOps) return 'cards'
  if (meta.hasUIWords || meta.isBlocking) return 'ui'
  if (meta.hasEventEmission) return 'events'
  if (meta.hasGraphOps) return 'graph'
  if (meta.hasEntityOps) return 'entities'
  return 'core'
}

/**
 * Determine all categories this card belongs to
 */
function determineCategories(meta: Partial<ParsedCardMeta>): CardCategory[] {
  const categories: CardCategory[] = []

  if (meta.isCommand) categories.push('command')
  if (meta.hasCardOps) categories.push('cards')
  if (meta.hasUIWords || meta.isBlocking) categories.push('ui')
  if (meta.hasEventEmission) categories.push('events')
  if (meta.hasGraphOps) categories.push('graph')
  if (meta.hasEntityOps) categories.push('entities')

  // Always include core as a fallback
  if (categories.length === 0) {
    categories.push('core')
  }

  return categories
}

/**
 * Parse card source and extract all semantic metadata
 */
export function parseCardMeta(source: string): ParsedCardMeta {
  const { name: wordName, isPrivate } = extractWordName(source)
  const vocabName = extractVocabName(source)
  const dependencies = extractDependencies(source)
  const keybinding = extractKeybinding(source)
  const docString = extractDocString(source)
  const isCommand = hasCommandMarker(source)

  const isBlocking = containsWords(source, BLOCKING_WORDS)
  const hasGraphOps = containsWords(source, GRAPH_WORDS)
  const hasEntityOps = containsWords(source, ENTITY_WORDS)
  const hasEventEmission = containsWords(source, EVENT_WORDS)
  const hasCardOps = containsWords(source, CARD_WORDS)
  const hasUIWords = containsWords(source, UI_WORDS)

  const partialMeta = {
    isCommand,
    hasCardOps,
    hasUIWords,
    isBlocking,
    hasEventEmission,
    hasGraphOps,
    hasEntityOps,
  }

  const primaryCategory = determinePrimaryCategory(partialMeta)
  const categories = determineCategories(partialMeta)
  const { score: complexityScore, lineCount, tier: complexityTier } = calculateComplexity(source, dependencies)

  return {
    wordName,
    vocabName,
    dependencies,
    isPrivate,
    isCommand,
    keybinding,
    docString,
    isBlocking,
    hasGraphOps,
    hasEntityOps,
    hasEventEmission,
    hasCardOps,
    hasUIWords,
    primaryCategory,
    categories,
    complexityScore,
    lineCount,
    complexityTier,
  }
}

/**
 * Format keybinding for display (e.g., "cmd+k" -> "⌘K")
 */
export function formatKeybinding(keybinding: string): string {
  return keybinding
    .replace(/cmd\+/gi, '⌘')
    .replace(/ctrl\+/gi, '⌃')
    .replace(/alt\+/gi, '⌥')
    .replace(/shift\+/gi, '⇧')
    .toUpperCase()
}

export default parseCardMeta
