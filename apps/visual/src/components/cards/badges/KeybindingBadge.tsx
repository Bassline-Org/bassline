/**
 * KeybindingBadge - Shows keybinding like ⌘K
 */

import { formatKeybinding } from '@/lib/cards/parseCardMeta'
import { cn } from '@/lib/utils'

export interface KeybindingBadgeProps {
  keybinding: string
  className?: string
}

export function KeybindingBadge({ keybinding, className }: KeybindingBadgeProps) {
  const formatted = formatKeybinding(keybinding)

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center',
        'px-1.5 py-0.5 rounded',
        'bg-zinc-700/60 text-zinc-300',
        'font-mono text-[10px] font-medium',
        'border border-zinc-600/50',
        className
      )}
      title={`Keybinding: ${keybinding}`}
    >
      {formatted}
    </div>
  )
}

export default KeybindingBadge
