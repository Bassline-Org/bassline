/**
 * CommandBadge - Terminal icon for cmd-marked cards
 */

import { Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CommandBadgeProps {
  className?: string
}

export function CommandBadge({ className }: CommandBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center',
        'w-5 h-5 rounded-full',
        'bg-indigo-500/20 text-indigo-400',
        className
      )}
      title="Command"
    >
      <Terminal className="h-3 w-3" />
    </div>
  )
}

export default CommandBadge
