import { useState, useCallback, useMemo } from 'react'
import { X, Trash2, Plus, Palette, Square, Circle, Diamond, Box, Hexagon, Plug, Link, Link2, Maximize2, Minimize2 } from 'lucide-react'
import type { EntityWithAttrs, Relationship } from '../types'
import { attrString, getAttr } from '../types'
import type { Vocabulary, AttrDefinition, PortDefinition } from '../lib/vocabularyParser'
import { getSemantic } from '../lib/semantics'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DebouncedInput } from './DebouncedInput'

interface PropertyPanelProps {
  entity: EntityWithAttrs
  entities: EntityWithAttrs[]
  relationships: Relationship[]
  vocabulary: Vocabulary
  onUpdateAttr: (key: string, value: string) => void
  onDeleteAttr: (key: string) => void
  onDeleteRelationship: (relationshipId: string) => void
  onDelete: () => void
  onClose: () => void
}

// Icon map for shapes
const shapeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  box: Box,
  rounded: Box,
  rect: Square,
  square: Square,
  circle: Circle,
  diamond: Diamond,
  hexagon: Hexagon,
}

// Common icons for quick selection
const commonIcons = [
  'box', 'circle', 'square', 'database', 'server', 'cloud', 'user', 'users',
  'file', 'folder', 'settings', 'zap', 'globe', 'cpu', 'hard-drive', 'network',
]

export function PropertyPanel({ entity, entities, relationships, vocabulary, onUpdateAttr, onDeleteAttr, onDeleteRelationship, onDelete, onClose }: PropertyPanelProps) {
  const [newAttrKey, setNewAttrKey] = useState('')
  const [newAttrValue, setNewAttrValue] = useState('')
  const [newBindingName, setNewBindingName] = useState('')
  const [newBindingPath, setNewBindingPath] = useState('')
  const [newPortName, setNewPortName] = useState('')

  const name = attrString(entity.attrs.name)
  const role = attrString(entity.attrs.role)

  // Visual attrs
  const visualShape = getAttr(entity.attrs, 'visual.shape', 'rounded')
  const visualFill = attrString(entity.attrs['visual.fill'])
  const visualStroke = attrString(entity.attrs['visual.stroke'])
  const visualIcon = attrString(entity.attrs['visual.icon'])

  // Get role vocabulary
  const roleVocab = useMemo(() => {
    return vocabulary.roles.find(r => r.value === role)
  }, [vocabulary.roles, role])

  // Valid direction values
  const directionValues = ['input', 'output', 'bidirectional'] as const
  type PortDirection = typeof directionValues[number]

  // Get port direction from attr value
  const getPortDirection = (value: string | undefined, vocabDef?: PortDefinition): PortDirection => {
    if (value === 'input' || value === 'output' || value === 'bidirectional') {
      return value
    }
    // Use vocabulary default if available, otherwise bidirectional
    return vocabDef?.direction ?? 'bidirectional'
  }

  // Check if port is enabled (value is truthy direction or 'true')
  const isPortEnabled = (value: string | undefined): boolean => {
    if (!value || value === 'false') return false
    return value === 'true' || directionValues.includes(value as PortDirection)
  }

  // Get all ports: vocabulary-defined + custom (from entity attrs)
  const allPorts = useMemo(() => {
    const ports: { name: string; enabled: boolean; direction: PortDirection; fromVocab: boolean; def?: PortDefinition }[] = []
    const seen = new Set<string>()

    // First add vocabulary-defined ports
    if (roleVocab) {
      for (const portDef of roleVocab.ports) {
        const attrKey = `port.${portDef.name}`
        const attrValue = attrString(entity.attrs[attrKey])
        ports.push({
          name: portDef.name,
          enabled: isPortEnabled(attrValue),
          direction: getPortDirection(attrValue, portDef),
          fromVocab: true,
          def: portDef,
        })
        seen.add(portDef.name)
      }
    }

    // Then add custom ports from entity attrs that aren't in vocabulary
    // Include 'false' values so disabled ports still show in the list
    for (const [key, value] of Object.entries(entity.attrs)) {
      if (key.startsWith('port.') && value) {
        const portName = key.slice(5)
        if (!seen.has(portName)) {
          const strValue = attrString(value)
          ports.push({
            name: portName,
            enabled: isPortEnabled(strValue),
            direction: getPortDirection(strValue),
            fromVocab: false,
          })
        }
      }
    }

    return ports
  }, [roleVocab, entity.attrs])

  const handleAddPort = useCallback(() => {
    if (newPortName.trim()) {
      onUpdateAttr(`port.${newPortName.trim()}`, 'true')
      setNewPortName('')
    }
  }, [newPortName, onUpdateAttr])

  // Kit bindings
  const kitBindings = useMemo(() => {
    return Object.entries(entity.attrs)
      .filter(([key]) => key.startsWith('kit.'))
      .map(([key, value]) => [key.slice(4), attrString(value)] as [string, string])
      .sort(([a], [b]) => a.localeCompare(b))
  }, [entity.attrs])

  // Semantic bindings - what this entity binds to (outgoing)
  const boundToSemantics = useMemo(() => {
    return relationships
      .filter(r => r.kind === 'binds' && r.from_entity === entity.id)
      .map(r => {
        const targetEntity = entities.find(e => e.id === r.to_entity)
        const semanticType = targetEntity ? attrString(targetEntity.attrs['semantic.type']) : ''
        const semantic = semanticType ? getSemantic(semanticType) : null
        return {
          relationshipId: r.id,
          targetId: r.to_entity,
          targetName: (targetEntity ? attrString(targetEntity.attrs.name) : '') || semantic?.name || 'Unknown',
          semanticType,
        }
      })
  }, [relationships, entities, entity.id])

  // Entities binding to this (incoming) - mainly relevant for semantic nodes
  const boundFromEntities = useMemo(() => {
    return relationships
      .filter(r => r.kind === 'binds' && r.to_entity === entity.id)
      .map(r => {
        const sourceEntity = entities.find(e => e.id === r.from_entity)
        return {
          relationshipId: r.id,
          sourceId: r.from_entity,
          sourceName: (sourceEntity ? attrString(sourceEntity.attrs.name) : '') || 'Unknown',
        }
      })
  }, [relationships, entities, entity.id])

  // Get custom attrs (not managed by dedicated sections)
  const customAttrs = useMemo(() => {
    const reserved = new Set(['name', 'role', 'x', 'y'])

    // Add role-specific attrs to reserved
    if (roleVocab) {
      for (const attr of roleVocab.attrs) {
        reserved.add(attr.key)
      }
    }

    return Object.entries(entity.attrs)
      .filter(([key]) =>
        !reserved.has(key) &&
        !key.startsWith('visual.') &&
        !key.startsWith('port.') &&
        !key.startsWith('kit.') &&
        !key.startsWith('config.') &&
        !key.startsWith('ui.')
      )
      .sort(([a], [b]) => a.localeCompare(b))
  }, [entity.attrs, roleVocab])

  const handleNameChange = useCallback(
    (newName: string) => {
      onUpdateAttr('name', newName)
    },
    [onUpdateAttr]
  )

  const handleRoleChange = useCallback(
    (newRole: string) => {
      if (newRole && newRole !== '__none__') {
        onUpdateAttr('role', newRole)

        // Apply role defaults
        const newRoleVocab = vocabulary.roles.find(r => r.value === newRole)
        if (newRoleVocab) {
          for (const [key, value] of Object.entries(newRoleVocab.defaults)) {
            if (!entity.attrs[key]) {
              onUpdateAttr(key, value)
            }
          }
        }
      } else {
        onDeleteAttr('role')
      }
    },
    [onUpdateAttr, onDeleteAttr, vocabulary.roles, entity.attrs]
  )

  const handleAddAttr = useCallback(() => {
    if (newAttrKey.trim()) {
      onUpdateAttr(newAttrKey.trim(), newAttrValue)
      setNewAttrKey('')
      setNewAttrValue('')
    }
  }, [newAttrKey, newAttrValue, onUpdateAttr])

  const handleAddBinding = useCallback(() => {
    if (newBindingName.trim() && newBindingPath.trim()) {
      onUpdateAttr(`kit.${newBindingName.trim()}`, newBindingPath.trim())
      setNewBindingName('')
      setNewBindingPath('')
    }
  }, [newBindingName, newBindingPath, onUpdateAttr])

  // Render a dynamic attribute editor based on type
  const renderAttrEditor = (attrDef: AttrDefinition) => {
    const value = attrString(entity.attrs[attrDef.key])

    switch (attrDef.type) {
      case 'select':
        return (
          <Select
            value={value || '__none__'}
            onValueChange={(v) => {
              if (v === '__none__') {
                onDeleteAttr(attrDef.key)
              } else {
                onUpdateAttr(attrDef.key, v)
              }
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder={attrDef.placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {!attrDef.required && <SelectItem value="__none__">None</SelectItem>}
              {attrDef.options?.map((opt) => {
                // Try to find a label from vocabulary (for lattices)
                const vocabItem = vocabulary.lattices.find(l => l.value === opt)
                return (
                  <SelectItem key={opt} value={opt}>
                    {vocabItem?.label || opt}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )

      case 'number':
        return (
          <DebouncedInput
            value={value}
            onChange={(v) => {
              if (v) {
                onUpdateAttr(attrDef.key, v)
              } else {
                onDeleteAttr(attrDef.key)
              }
            }}
            placeholder={attrDef.placeholder}
            className="h-8"
            type="number"
          />
        )

      case 'boolean':
        return (
          <Switch
            checked={value === 'true'}
            onCheckedChange={(checked) => {
              if (checked) {
                onUpdateAttr(attrDef.key, 'true')
              } else {
                onDeleteAttr(attrDef.key)
              }
            }}
          />
        )

      case 'color':
        return (
          <div className="flex gap-1">
            <Input
              type="color"
              value={value || '#1e1e2e'}
              onChange={(e) => onUpdateAttr(attrDef.key, e.target.value)}
              className="h-8 w-10 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={value}
              onChange={(e) => onUpdateAttr(attrDef.key, e.target.value)}
              placeholder="none"
              className="h-8 flex-1 text-xs"
            />
          </div>
        )

      case 'path':
      case 'string':
      default:
        return (
          <DebouncedInput
            value={value}
            onChange={(v) => {
              if (v) {
                onUpdateAttr(attrDef.key, v)
              } else {
                onDeleteAttr(attrDef.key)
              }
            }}
            placeholder={attrDef.placeholder}
            className="h-8"
          />
        )
    }
  }

  return (
    <Card className="w-80 h-full rounded-none border-l border-t-0 border-b-0 border-r-0 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Properties</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Identity Section */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Identity</Label>

          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs">Name</Label>
            <DebouncedInput
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder="Entity name"
              className="h-8"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="role" className="text-xs">Role</Label>
            <Select
              value={role || '__none__'}
              onValueChange={handleRoleChange}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {vocabulary.roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Appearance Section */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Palette className="h-3 w-3" />
            Appearance
          </Label>

          <div className="space-y-1">
            <Label className="text-xs">Shape</Label>
            <Select
              value={visualShape}
              onValueChange={(value) => onUpdateAttr('visual.shape', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vocabulary.shapes.map((shape) => {
                  const Icon = shapeIcons[shape.icon || shape.value] || Box
                  return (
                    <SelectItem key={shape.value} value={shape.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3 w-3" />
                        {shape.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Fill</Label>
              <div className="flex gap-1">
                <Input
                  type="color"
                  value={visualFill || '#1e1e2e'}
                  onChange={(e) => onUpdateAttr('visual.fill', e.target.value)}
                  className="h-8 w-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={visualFill}
                  onChange={(e) => onUpdateAttr('visual.fill', e.target.value)}
                  placeholder="none"
                  className="h-8 flex-1 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stroke</Label>
              <div className="flex gap-1">
                <Input
                  type="color"
                  value={visualStroke || '#3f3f56'}
                  onChange={(e) => onUpdateAttr('visual.stroke', e.target.value)}
                  className="h-8 w-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={visualStroke}
                  onChange={(e) => onUpdateAttr('visual.stroke', e.target.value)}
                  placeholder="none"
                  className="h-8 flex-1 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Icon</Label>
            <Select
              value={visualIcon || '__none__'}
              onValueChange={(value) => {
                if (value === '__none__') {
                  onDeleteAttr('visual.icon')
                } else {
                  onUpdateAttr('visual.icon', value)
                }
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {commonIcons.map((icon) => (
                  <SelectItem key={icon} value={icon}>
                    {icon}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Display Section - collapse mode, size */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Maximize2 className="h-3 w-3" />
            Display
          </Label>

          <div className="space-y-1">
            <Label className="text-xs">Collapse Mode</Label>
            <Select
              value={attrString(entity.attrs['ui.collapse']) || 'expanded'}
              onValueChange={(value) => {
                if (value === 'expanded') {
                  onDeleteAttr('ui.collapse')
                } else {
                  onUpdateAttr('ui.collapse', value)
                }
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expanded">
                  <span className="flex items-center gap-2">
                    <Maximize2 className="h-3 w-3" />
                    Expanded
                  </span>
                </SelectItem>
                <SelectItem value="collapsed">
                  <span className="flex items-center gap-2">
                    <Minimize2 className="h-3 w-3" />
                    Collapsed
                  </span>
                </SelectItem>
                <SelectItem value="compact">
                  <span className="flex items-center gap-2">
                    <Box className="h-3 w-3" />
                    Compact (icon only)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Width (px)</Label>
              <DebouncedInput
                value={attrString(entity.attrs['ui.width'])}
                onChange={(value) => {
                  if (value) {
                    onUpdateAttr('ui.width', value)
                  } else {
                    onDeleteAttr('ui.width')
                  }
                }}
                placeholder="auto"
                className="h-8"
                type="number"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Height (px)</Label>
              <DebouncedInput
                value={attrString(entity.attrs['ui.height'])}
                onChange={(value) => {
                  if (value) {
                    onUpdateAttr('ui.height', value)
                  } else {
                    onDeleteAttr('ui.height')
                  }
                }}
                placeholder="auto"
                className="h-8"
                type="number"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Ports Section - Vocabulary + Custom */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Plug className="h-3 w-3" />
            Ports
          </Label>

          {allPorts.length > 0 && (
            <div className="space-y-2">
              {allPorts.map(({ name: portName, enabled, direction, fromVocab, def }) => (
                <div key={portName} className="flex items-center gap-2">
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        // Enable with current direction (or bidirectional default)
                        onUpdateAttr(`port.${portName}`, direction)
                      } else {
                        onUpdateAttr(`port.${portName}`, 'false')
                      }
                    }}
                  />
                  <span className="text-sm flex-1" title={def?.description}>
                    {def?.label || portName}
                  </span>
                  {enabled && (
                    <Select
                      value={direction}
                      onValueChange={(value) => onUpdateAttr(`port.${portName}`, value)}
                    >
                      <SelectTrigger className="h-6 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bidirectional">Both</SelectItem>
                        <SelectItem value="input">In</SelectItem>
                        <SelectItem value="output">Out</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {!fromVocab && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => onDeleteAttr(`port.${portName}`)}
                      title="Remove port"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={newPortName}
              onChange={(e) => setNewPortName(e.target.value)}
              placeholder="Add port..."
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddPort()
              }}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleAddPort}
              disabled={!newPortName.trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Kit Bindings Section */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Link className="h-3 w-3" />
            Kit Bindings
          </Label>

          {kitBindings.map(([bindingName, path]) => (
            <div key={bindingName} className="flex items-center gap-2">
              <Input
                value={bindingName}
                disabled
                className="h-8 text-sm w-20"
              />
              <DebouncedInput
                value={path}
                onChange={(newPath) => onUpdateAttr(`kit.${bindingName}`, newPath)}
                placeholder="/path"
                className="h-8 text-sm flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDeleteAttr(`kit.${bindingName}`)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-2">
            <Input
              type="text"
              value={newBindingName}
              onChange={(e) => setNewBindingName(e.target.value)}
              placeholder="name"
              className="h-8 text-sm w-20"
            />
            <Input
              type="text"
              value={newBindingPath}
              onChange={(e) => setNewBindingPath(e.target.value)}
              placeholder="/path"
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddBinding()
              }}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleAddBinding}
              disabled={!newBindingName.trim() || !newBindingPath.trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Semantic Bindings Section */}
        {(boundToSemantics.length > 0 || boundFromEntities.length > 0) && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Semantic Bindings
              </Label>

              {/* Bound to (outgoing) */}
              {boundToSemantics.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Bound to</Label>
                  {boundToSemantics.map((binding) => (
                    <div key={binding.relationshipId} className="flex items-center gap-2 pl-2">
                      <span className="text-sm flex-1 truncate" title={binding.targetName || undefined}>
                        {binding.targetName}
                      </span>
                      {binding.semanticType && (
                        <span className="text-xs text-muted-foreground">
                          {binding.semanticType}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onDeleteRelationship(binding.relationshipId)}
                        title="Remove binding"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bound from (incoming) */}
              {boundFromEntities.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Bound from</Label>
                  {boundFromEntities.map((binding) => (
                    <div key={binding.relationshipId} className="flex items-center gap-2 pl-2">
                      <span className="text-sm flex-1 truncate" title={binding.sourceName || undefined}>
                        {binding.sourceName}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onDeleteRelationship(binding.relationshipId)}
                        title="Remove binding"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Configuration Section - Dynamic based on role vocabulary */}
        {roleVocab && roleVocab.attrs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Configuration</Label>

              {roleVocab.attrs.map((attrDef) => (
                <div key={attrDef.key} className="space-y-1">
                  <Label className="text-xs">{attrDef.label}</Label>
                  {renderAttrEditor(attrDef)}
                </div>
              ))}
            </div>
          </>
        )}

        <Separator />

        {/* Custom Attributes Section */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Custom Attributes</Label>

          {customAttrs.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">{key}</Label>
                <DebouncedInput
                  value={attrString(value)}
                  onChange={(newValue) => onUpdateAttr(key, newValue)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 mt-5"
                onClick={() => onDeleteAttr(key)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-2 pt-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Add attribute</Label>
              <Input
                type="text"
                value={newAttrKey}
                onChange={(e) => setNewAttrKey(e.target.value)}
                placeholder="key"
                className="h-8 text-sm"
              />
            </div>
            <Input
              type="text"
              value={newAttrValue}
              onChange={(e) => setNewAttrValue(e.target.value)}
              placeholder="value"
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddAttr()
              }}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleAddAttr}
              disabled={!newAttrKey.trim()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (confirm(`Delete "${name || 'this entity'}"?`)) {
              onDelete()
            }
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Entity
        </Button>
      </CardContent>
    </Card>
  )
}
