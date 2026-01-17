/**
 * SettingsPanel
 *
 * Auto-generated settings UI from registered Borth settings.
 * Renders appropriate controls based on setting types.
 */

import { useState, useEffect, useCallback } from 'react'
import { getSettings, updateSetting, type Setting } from './BorthProvider'
import { useToast } from './ToastProvider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface SettingsPanelProps {
  className?: string
}

export function SettingsPanel({ className }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  // Load settings
  useEffect(() => {
    getSettings()
      .then(setSettings)
      .finally(() => setLoading(false))
  }, [])

  // Update a setting
  const handleUpdate = useCallback(
    async (name: string, value: unknown) => {
      try {
        await updateSetting(name, value)
        setSettings(prev =>
          prev.map(s => (s.name === name ? { ...s, current_value: value } : s))
        )
        showToast({
          type: 'success',
          title: 'Setting updated',
          duration: 1500,
        })
      } catch (e) {
        showToast({
          type: 'error',
          title: 'Failed to update setting',
          message: e instanceof Error ? e.message : String(e),
        })
      }
    },
    [showToast]
  )

  // Group settings by category
  const grouped = settings.reduce(
    (acc, setting) => {
      const category = setting.category || 'General'
      if (!acc[category]) acc[category] = []
      acc[category].push(setting)
      return acc
    },
    {} as Record<string, Setting[]>
  )

  if (loading) {
    return (
      <div className={cn('p-4 text-muted-foreground', className)}>
        Loading settings...
      </div>
    )
  }

  if (settings.length === 0) {
    return (
      <div className={cn('p-4 text-muted-foreground', className)}>
        No settings registered. Define settings in your Borth scripts using the{' '}
        <code className="bg-muted px-1 rounded">setting</code> word.
      </div>
    )
  }

  return (
    <div className={cn('space-y-8', className)}>
      {Object.entries(grouped).map(([category, categorySettings]) => (
        <section key={category}>
          <h3 className="text-lg font-semibold mb-4 capitalize">{category}</h3>
          <div className="space-y-4">
            {categorySettings.map(setting => (
              <SettingControl
                key={setting.name}
                setting={setting}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

interface SettingControlProps {
  setting: Setting
  onUpdate: (name: string, value: unknown) => void
}

function SettingControl({ setting, onUpdate }: SettingControlProps) {
  const value = setting.current_value ?? setting.default_value

  switch (setting.type) {
    case 'boolean':
      return (
        <BooleanSetting
          setting={setting}
          value={Boolean(value)}
          onUpdate={onUpdate}
        />
      )

    case 'number':
      return (
        <NumberSetting
          setting={setting}
          value={Number(value) || 0}
          onUpdate={onUpdate}
        />
      )

    case 'choice':
      return (
        <ChoiceSetting
          setting={setting}
          value={String(value || '')}
          onUpdate={onUpdate}
        />
      )

    case 'string':
    default:
      return (
        <StringSetting
          setting={setting}
          value={String(value || '')}
          onUpdate={onUpdate}
        />
      )
  }
}

interface SettingFieldProps<T> {
  setting: Setting
  value: T
  onUpdate: (name: string, value: T) => void
}

function BooleanSetting({
  setting,
  value,
  onUpdate,
}: SettingFieldProps<boolean>) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-0.5">
        <Label className="text-base">{formatName(setting.name)}</Label>
        {setting.doc && (
          <p className="text-sm text-muted-foreground">{setting.doc}</p>
        )}
      </div>
      <Switch
        checked={value}
        onCheckedChange={checked => onUpdate(setting.name, checked)}
      />
    </div>
  )
}

function NumberSetting({
  setting,
  value,
  onUpdate,
}: SettingFieldProps<number>) {
  const min = setting.constraints?.min
  const max = setting.constraints?.max
  const step = setting.constraints?.step ?? 1

  return (
    <div className="space-y-2">
      <Label>{formatName(setting.name)}</Label>
      {setting.doc && (
        <p className="text-sm text-muted-foreground">{setting.doc}</p>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => onUpdate(setting.name, parseFloat(e.target.value) || 0)}
          className="w-32"
        />
        {min !== undefined && max !== undefined && (
          <input
            type="range"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={e => onUpdate(setting.name, parseFloat(e.target.value) || 0)}
            className="flex-1"
          />
        )}
      </div>
    </div>
  )
}

function StringSetting({
  setting,
  value,
  onUpdate,
}: SettingFieldProps<string>) {
  const [localValue, setLocalValue] = useState(value)

  // Sync local value when setting changes externally
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounced update
  const handleBlur = () => {
    if (localValue !== value) {
      onUpdate(setting.name, localValue)
    }
  }

  return (
    <div className="space-y-2">
      <Label>{formatName(setting.name)}</Label>
      {setting.doc && (
        <p className="text-sm text-muted-foreground">{setting.doc}</p>
      )}
      <Input
        type="text"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        maxLength={setting.constraints?.maxlength}
      />
    </div>
  )
}

function ChoiceSetting({
  setting,
  value,
  onUpdate,
}: SettingFieldProps<string>) {
  const choices = setting.constraints?.choices ?? []

  return (
    <div className="space-y-2">
      <Label>{formatName(setting.name)}</Label>
      {setting.doc && (
        <p className="text-sm text-muted-foreground">{setting.doc}</p>
      )}
      <Select value={value} onValueChange={v => onUpdate(setting.name, v)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map(choice => (
            <SelectItem key={choice} value={choice}>
              {choice}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Format a setting name for display
 * foo-bar-baz -> Foo Bar Baz
 */
function formatName(name: string): string {
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
