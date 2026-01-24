/**
 * ViewControls - Display mode and density toggles
 *
 * Toggle group for switching between card display modes.
 */

import type { CardDisplayMode, CardDensity } from '@/types'
import { useCardView } from './CardViewProvider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Code2, Image, AlignLeft, List } from 'lucide-react'
import { cn } from '@/lib/utils'

const DISPLAY_MODES: { value: CardDisplayMode; icon: typeof Code2; label: string }[] = [
  { value: 'code', icon: Code2, label: 'Code' },
  { value: 'art', icon: Image, label: 'Art' },
  { value: 'text', icon: AlignLeft, label: 'Text' },
  { value: 'minimal', icon: List, label: 'List' },
]

const DENSITY_OPTIONS: { value: CardDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'spacious', label: 'Spacious' },
]

export interface ViewControlsProps {
  /** Control card or set display mode */
  target?: 'cards' | 'sets'
  /** Show density selector */
  showDensity?: boolean
  /** Additional CSS class */
  className?: string
}

export function ViewControls({
  target = 'cards',
  showDensity = true,
  className,
}: ViewControlsProps) {
  const { config, setDisplayMode, setSetDisplayMode, setDensity } = useCardView()

  const currentMode = target === 'cards'
    ? config.defaultDisplayMode
    : config.defaultSetDisplayMode

  const handleModeChange = (value: string) => {
    if (!value) return // toggle group can return empty string
    const mode = value as CardDisplayMode
    if (target === 'cards') {
      setDisplayMode(mode)
    } else {
      setSetDisplayMode(mode)
    }
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Display mode toggle */}
      <ToggleGroup
        type="single"
        value={currentMode}
        onValueChange={handleModeChange}
        className="bg-secondary/50 rounded-md p-0.5"
      >
        {DISPLAY_MODES.map(({ value, icon: Icon, label }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={`${label} view`}
            className="h-7 w-7 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            title={label}
          >
            <Icon className="h-4 w-4" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Density selector */}
      {showDensity && (
        <Select
          value={config.density}
          onValueChange={(value) => setDensity(value as CardDensity)}
        >
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DENSITY_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

export default ViewControls
