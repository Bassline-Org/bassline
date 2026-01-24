/**
 * BlockingBadge - Pause icon for cards that wait for user input
 */

import { Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BlockingBadgeProps {
  className?: string
}

export function BlockingBadge({ className }: BlockingBadgeProps) {
  return (
    <div
      className={cn(
        'card-badge--blocking',
        'inline-flex items-center justify-center',
        'w-5 h-5 rounded-full',
        'bg-amber-500/20 text-amber-400',
        className
      )}
      title="Blocking - waits for user input"
    >
      <Pause className="h-3 w-3" />
    </div>
  )
}

export default BlockingBadge
