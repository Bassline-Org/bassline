/**
 * CardArtwork - Local artwork images for cards
 *
 * Uses a hash of the seed to deterministically select from local images.
 * Images are stored in public/artwork/ to avoid CSP issues.
 */

import { cn } from '@/lib/utils'

// Number of available artwork images
const ARTWORK_COUNT = 24

export interface CardArtworkProps {
  /** Seed for consistent image selection (typically card.id) */
  seed: string
  /** Width in pixels (unused, kept for API compatibility) */
  width?: number
  /** Height in pixels (unused, kept for API compatibility) */
  height?: number
  /** Apply grayscale filter via CSS */
  grayscale?: boolean
  /** Blur amount (0-10) via CSS */
  blur?: number
  /** Additional CSS classes */
  className?: string
  /** Alt text for accessibility */
  alt?: string
}

/**
 * Simple hash function to convert a string to a number
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Get local artwork path based on seed
 * Uses relative path for Electron file:// protocol compatibility
 */
export function getArtworkPath(seed: string): string {
  const index = (hashString(seed) % ARTWORK_COUNT) + 1
  return `artwork/art-${index}.jpg`
}

/**
 * Build a Lorem Picsum URL (kept for potential future use)
 */
export function buildPicsumUrl(
  seed: string,
  width: number,
  height: number,
  opts?: { grayscale?: boolean; blur?: number }
): string {
  let url = `https://picsum.photos/seed/${seed}/${width}/${height}`
  const params: string[] = []
  if (opts?.grayscale) params.push('grayscale')
  if (opts?.blur && opts.blur > 0) params.push(`blur=${Math.min(10, Math.max(1, opts.blur))}`)
  return params.length ? `${url}?${params.join('&')}` : url
}

export function CardArtwork({
  seed,
  grayscale = false,
  blur,
  className,
  alt = 'Card artwork',
}: CardArtworkProps) {
  const url = getArtworkPath(seed)

  // Build CSS filter for grayscale/blur effects
  const filters: string[] = []
  if (grayscale) filters.push('grayscale(100%)')
  if (blur && blur > 0) filters.push(`blur(${blur}px)`)
  const filterStyle = filters.length > 0 ? { filter: filters.join(' ') } : undefined

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      style={filterStyle}
      className={cn(
        'object-cover w-full h-full',
        className
      )}
    />
  )
}

export default CardArtwork
