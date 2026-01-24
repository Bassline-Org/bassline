/**
 * ArtContent - Enhanced TCG-style card display mode
 *
 * MTG-inspired card frame with semantic visual language:
 * - Category-tinted title bar and artwork overlay
 * - Badge indicators for blocking, command, keybinding
 * - Dependency pills
 * - Complexity-based depth layers
 */

import type { Card, CardDisplayMeta } from '@/types'
import { CardArtwork } from '../core/CardArtwork'
import { parseCardMeta, type ParsedCardMeta } from '@/lib/cards/parseCardMeta'
import { getCategoryClass } from '@/lib/cards/categoryColors'
import {
  CardCategoryBadge,
  BlockingBadge,
  CommandBadge,
  KeybindingBadge,
  DependencyPills,
} from '../badges'

export interface ArtContentProps {
  card: Card
  meta?: CardDisplayMeta
}

/**
 * Get display title for card
 */
function getCardTitle(parsedMeta: ParsedCardMeta, displayMeta?: CardDisplayMeta): string {
  if (displayMeta?.title) return displayMeta.title
  if (parsedMeta.wordName) return parsedMeta.wordName
  if (parsedMeta.vocabName) return `${parsedMeta.vocabName} vocab`
  return 'Untitled'
}

/**
 * Get card type line text
 */
function getTypeLine(parsedMeta: ParsedCardMeta): string {
  if (parsedMeta.wordName && parsedMeta.vocabName) {
    return `Word · ${parsedMeta.vocabName}`
  }
  if (parsedMeta.wordName) {
    return 'Word'
  }
  if (parsedMeta.vocabName) {
    return 'Vocabulary'
  }
  return 'Source'
}

/**
 * Get text box content (description or code preview)
 */
function getTextContent(source: string, parsedMeta: ParsedCardMeta, displayMeta?: CardDisplayMeta): string {
  if (displayMeta?.description) return displayMeta.description
  if (parsedMeta.docString) return parsedMeta.docString

  // Fall back to code preview - first few meaningful lines
  const lines = source
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('\\') && !l.trim().startsWith('('))
    .slice(0, 3)
    .map((l) => l.trim())
    .join('\n')

  return lines || source.slice(0, 80)
}

/**
 * Build CSS class list for card based on parsed meta
 */
function buildCardClasses(parsedMeta: ParsedCardMeta): string {
  const classes: string[] = ['tcg-card']

  // Category class
  classes.push(getCategoryClass(parsedMeta.primaryCategory))

  // State modifiers
  if (parsedMeta.isPrivate) classes.push('tcg-card--private')
  if (parsedMeta.isCommand) classes.push('tcg-card--command')
  if (parsedMeta.isBlocking) classes.push('tcg-card--blocking')

  // Complexity tier
  classes.push(`tcg-card--${parsedMeta.complexityTier}`)

  return classes.join(' ')
}

export function ArtContent({ card, meta }: ArtContentProps) {
  // Parse semantic metadata from source
  const parsedMeta = parseCardMeta(card.source)

  const title = getCardTitle(parsedMeta, meta)
  const typeLine = getTypeLine(parsedMeta)
  const textContent = getTextContent(card.source, parsedMeta, meta)
  const seed = meta?.artworkSeed ?? card.id
  const cardClasses = buildCardClasses(parsedMeta)

  return (
    <div className={cardClasses}>
      <div className="tcg-card__inner">
        {/* Title Bar */}
        <div className="tcg-card__title">
          <div className="tcg-card__title-row">
            <div className="tcg-card__title-left">
              <CardCategoryBadge category={parsedMeta.primaryCategory} size="sm" />
              <span className="tcg-card__title-text">{title}</span>
            </div>
            <div className="tcg-card__badges">
              {parsedMeta.isCommand && <CommandBadge />}
              {parsedMeta.keybinding && (
                <KeybindingBadge keybinding={parsedMeta.keybinding} />
              )}
            </div>
          </div>
        </div>

        {/* Art Window */}
        <div className="tcg-card__art">
          <CardArtwork
            seed={seed}
            width={300}
            height={200}
            grayscale={meta?.artworkGrayscale}
            blur={meta?.artworkBlur}
            className="tcg-card__art-img"
            alt={title}
          />
        </div>

        {/* Type Line */}
        <div className="tcg-card__type">
          <div className="tcg-card__type-row">
            <span>{typeLine}</span>
            {parsedMeta.isBlocking && <BlockingBadge />}
          </div>
        </div>

        {/* Text Box */}
        <div className="tcg-card__text">
          <div className="flex flex-col gap-2 w-full">
            <p className="tcg-card__text-content">{textContent}</p>
            {parsedMeta.dependencies.length > 0 && (
              <DependencyPills
                dependencies={parsedMeta.dependencies}
                maxVisible={3}
              />
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="tcg-card__stats">
          <div className="tcg-card__stats-row">
            <div className="tcg-card__stats-left">
              <span className="tcg-card__stat">v{card.head_version}</span>
              <span className="tcg-card__stat">{parsedMeta.lineCount} LoC</span>
            </div>
            {parsedMeta.keybinding && (
              <span className="tcg-card__stat font-sans text-zinc-400">
                {parsedMeta.keybinding}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtContent
