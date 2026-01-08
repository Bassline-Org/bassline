/**
 * Help Semantic
 *
 * Displays and edits documentation stored as attributes on entities.
 * Bind any entity to see/edit its help.* attributes.
 *
 * Recognized attributes:
 * - help.summary = Brief one-line description
 * - help.description = Detailed explanation (supports markdown)
 * - help.usage = How to use/configure
 * - help.examples = Example configurations or use cases
 * - help.* = Any other help attributes are displayed
 */

import { useMemo, useCallback, useState, useEffect } from 'react'
import { HelpCircle, Edit2, Save, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { EntityWithAttrs, EditorLoaderData } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'

interface HelpSemanticProps {
  entity: EntityWithAttrs
}

// Help attribute display order and labels
const HELP_ATTRS = [
  { key: 'help.summary', label: 'Summary', multiline: false },
  { key: 'help.description', label: 'Description', multiline: true },
  { key: 'help.usage', label: 'Usage', multiline: true },
  { key: 'help.examples', label: 'Examples', multiline: true },
]

// Extract help attributes from an entity
function getHelpAttrs(entity: EntityWithAttrs): Record<string, string> {
  const help: Record<string, string> = {}
  for (const [key, value] of Object.entries(entity.attrs)) {
    if (key.startsWith('help.')) {
      help[key] = value
    }
  }
  return help
}

// Local input that persists on blur
function LocalInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])

  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local)
      }}
      placeholder={placeholder}
      className="help-semantic__input"
    />
  )
}

// Local textarea that persists on blur
function LocalTextarea({
  value,
  onCommit,
  placeholder,
  rows = 3,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])

  return (
    <Textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local)
      }}
      placeholder={placeholder}
      className="help-semantic__textarea"
      rows={rows}
    />
  )
}

export function HelpSemantic({ entity }: HelpSemanticProps) {
  const { project } = useLoaderData() as EditorLoaderData
  const { inputEntities } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()

  const [isEditing, setIsEditing] = useState(false)
  const [newAttrKey, setNewAttrKey] = useState('')

  // Get the target entity (first bound entity)
  const targetEntity = inputEntities[0] || null

  // Get help attributes from target
  const helpAttrs = useMemo(() => {
    if (!targetEntity) return {}
    return getHelpAttrs(targetEntity)
  }, [targetEntity])

  // Get custom help attrs (not in the standard list)
  const customHelpAttrs = useMemo(() => {
    const standardKeys = new Set(HELP_ATTRS.map(a => a.key))
    return Object.entries(helpAttrs)
      .filter(([key]) => !standardKeys.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [helpAttrs])

  // Update a help attribute
  const handleAttrChange = useCallback(
    async (key: string, value: string) => {
      if (!targetEntity) return
      await bl.attrs.set(project.id, targetEntity.id, key, value)
      revalidate()
    },
    [bl, project.id, targetEntity, revalidate]
  )

  // Add a new custom help attribute
  const handleAddAttr = useCallback(async () => {
    if (!targetEntity || !newAttrKey.trim()) return
    const key = newAttrKey.startsWith('help.') ? newAttrKey : `help.${newAttrKey}`
    await bl.attrs.set(project.id, targetEntity.id, key, '')
    setNewAttrKey('')
    revalidate()
  }, [bl, project.id, targetEntity, newAttrKey, revalidate])

  // Delete a help attribute
  const handleDeleteAttr = useCallback(
    async (key: string) => {
      if (!targetEntity) return
      await bl.attrs.delete(project.id, targetEntity.id, key)
      revalidate()
    },
    [bl, project.id, targetEntity, revalidate]
  )

  // Render a help section
  const renderHelpSection = (
    key: string,
    label: string,
    multiline: boolean,
    value: string | undefined,
    isCustom = false
  ) => {
    if (!isEditing && !value) return null

    return (
      <div key={key} className="help-semantic__section">
        <div className="help-semantic__section-header">
          <Label className="help-semantic__section-label">{label}</Label>
          {isEditing && isCustom && (
            <Button
              variant="ghost"
              size="icon"
              className="help-semantic__delete-btn"
              onClick={() => handleDeleteAttr(key)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {isEditing ? (
          multiline ? (
            <LocalTextarea
              value={value || ''}
              onCommit={(v) => handleAttrChange(key, v)}
              placeholder={`Enter ${label.toLowerCase()}...`}
              rows={key === 'help.description' ? 4 : 3}
            />
          ) : (
            <LocalInput
              value={value || ''}
              onCommit={(v) => handleAttrChange(key, v)}
              placeholder={`Enter ${label.toLowerCase()}...`}
            />
          )
        ) : (
          <div className="help-semantic__content">
            {value?.split('\n').map((line, i) => (
              <p key={i}>{line || '\u00A0'}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!targetEntity) {
    return (
      <div className="help-semantic">
        <div className="help-semantic__empty">
          <HelpCircle className="h-8 w-8 opacity-50" />
          <p>Bind an entity to view/edit its documentation</p>
        </div>
      </div>
    )
  }

  const hasAnyHelp = Object.keys(helpAttrs).length > 0

  return (
    <div className="help-semantic">
      <div className="help-semantic__header">
        <div className="help-semantic__target">
          <HelpCircle className="h-4 w-4" />
          <span className="help-semantic__target-name">
            {targetEntity.attrs.name || 'Unnamed'}
          </span>
          {targetEntity.attrs.role && (
            <span className="help-semantic__target-role">
              {targetEntity.attrs.role}
            </span>
          )}
        </div>
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? (
            <>
              <Save className="h-3 w-3 mr-1" />
              Done
            </>
          ) : (
            <>
              <Edit2 className="h-3 w-3 mr-1" />
              Edit
            </>
          )}
        </Button>
      </div>

      <ScrollArea className="help-semantic__scroll">
        <div className="help-semantic__body">
          {!hasAnyHelp && !isEditing ? (
            <div className="help-semantic__no-docs">
              <p>No documentation yet.</p>
              <p className="help-semantic__hint">Click Edit to add help content.</p>
            </div>
          ) : (
            <>
              {/* Standard help attributes */}
              {HELP_ATTRS.map(({ key, label, multiline }) =>
                renderHelpSection(key, label, multiline, helpAttrs[key])
              )}

              {/* Custom help attributes */}
              {customHelpAttrs.map(([key, value]) => {
                const label = key.replace('help.', '')
                return renderHelpSection(key, label, true, value, true)
              })}

              {/* Add custom attribute */}
              {isEditing && (
                <div className="help-semantic__add-section">
                  <Label className="help-semantic__section-label">Add custom section</Label>
                  <div className="help-semantic__add-row">
                    <Input
                      value={newAttrKey}
                      onChange={(e) => setNewAttrKey(e.target.value)}
                      placeholder="section name"
                      className="help-semantic__add-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddAttr()
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddAttr}
                      disabled={!newAttrKey.trim()}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {inputEntities.length > 1 && (
        <div className="help-semantic__multi-hint">
          Showing help for first of {inputEntities.length} bound entities
        </div>
      )}
    </div>
  )
}
