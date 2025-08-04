/**
 * ModeMenu - UI for switching major modes and toggling minor modes
 */

import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { ChevronDown, Layers } from 'lucide-react'
import type { ModeInfo } from '~/propagation-react/modes'

interface ModeMenuProps {
  currentMajorMode: string | null
  activeMinorModes: string[]
  availableModes: ModeInfo[]
  onSwitchMajorMode: (modeId: string) => void
  onToggleMinorMode: (modeId: string) => void
  className?: string
}

export function ModeMenu({
  currentMajorMode,
  activeMinorModes,
  availableModes,
  onSwitchMajorMode,
  onToggleMinorMode,
  className = ''
}: ModeMenuProps) {
  const [showMinorModes, setShowMinorModes] = useState(false)
  
  const majorModes = availableModes.filter(mode => mode.type === 'major')
  const minorModes = availableModes.filter(mode => mode.type === 'minor')
  
  const currentMajor = majorModes.find(m => m.id === currentMajorMode)
  
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Major mode selector */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="min-w-[120px] justify-between"
            >
              <span className="flex items-center gap-2">
                {currentMajor?.icon && <span>{currentMajor.icon}</span>}
                <span>{currentMajor?.name || 'No Mode'}</span>
              </span>
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Major Mode</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {majorModes.map(mode => (
              <DropdownMenuItem
                key={mode.id}
                onClick={() => onSwitchMajorMode(mode.id)}
                className="cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {mode.icon && <span>{mode.icon}</span>}
                  <span>{mode.name}</span>
                </span>
                {mode.description && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {mode.description}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Minor modes toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMinorModes(!showMinorModes)}
          className="px-2"
          title="Toggle minor modes panel"
        >
          <Layers className="h-4 w-4" />
          {activeMinorModes.length > 0 && (
            <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">
              {activeMinorModes.length}
            </span>
          )}
        </Button>
      </div>
      
      {/* Minor modes panel */}
      {showMinorModes && (
        <Card className="p-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Minor Modes</Label>
            {minorModes.map(mode => (
              <div
                key={mode.id}
                className="flex items-center justify-between py-1"
              >
                <Label
                  htmlFor={`minor-${mode.id}`}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  {mode.icon && <span>{mode.icon}</span>}
                  <span>{mode.name}</span>
                  {mode.shortcut && (
                    <kbd className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded ml-1">
                      {mode.shortcut}
                    </kbd>
                  )}
                </Label>
                <Switch
                  id={`minor-${mode.id}`}
                  checked={activeMinorModes.includes(mode.id)}
                  onCheckedChange={() => onToggleMinorMode(mode.id)}
                  className="cursor-pointer"
                />
              </div>
            ))}
            {minorModes.length === 0 && (
              <p className="text-sm text-muted-foreground">No minor modes available</p>
            )}
          </div>
        </Card>
      )}
      
      {/* Active modes indicator */}
      {activeMinorModes.length > 0 && !showMinorModes && (
        <div className="flex flex-wrap gap-1">
          {activeMinorModes.map(modeId => {
            const mode = minorModes.find(m => m.id === modeId)
            if (!mode) return null
            return (
              <span
                key={modeId}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-secondary rounded-full"
              >
                {mode.icon && <span>{mode.icon}</span>}
                <span>{mode.name}</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}