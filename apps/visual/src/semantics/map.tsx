/**
 * Map Combinator
 *
 * Transforms entity attributes.
 *
 * Configuration (via entity attrs):
 * - map.set.<attrName> = value (supports ${attr} interpolation)
 * - map.add.<attrName> = value (only if attr doesn't exist)
 * - map.remove.<attrName> = "true"
 */

import { useMemo, useCallback, useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EntityWithAttrs, DataObject, AttrValue } from '../types'
import { attrString } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import type { EditorLoaderData } from '../types'

interface MapSemanticProps {
  entity: EntityWithAttrs
}

interface MapRule {
  operation: 'set' | 'add' | 'remove'
  attrName: string
  value: string
  attrKey: string // Original attr key for deletion
}

// Local input that persists on blur to avoid focus loss
function LocalInput({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  className?: string
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
      className={className}
    />
  )
}

// Parse map rules from entity attrs
function parseMapRules(attrs: Record<string, AttrValue>): MapRule[] {
  const rules: MapRule[] = []

  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('map.set.')) {
      rules.push({
        operation: 'set',
        attrName: key.slice(8),
        value: attrString(value),
        attrKey: key,
      })
    } else if (key.startsWith('map.add.')) {
      rules.push({
        operation: 'add',
        attrName: key.slice(8),
        value: attrString(value),
        attrKey: key,
      })
    } else if (key.startsWith('map.remove.')) {
      rules.push({
        operation: 'remove',
        attrName: key.slice(11),
        value: '',
        attrKey: key,
      })
    }
  }

  return rules.sort((a, b) => a.attrName.localeCompare(b.attrName))
}

// Interpolate ${attr} references in value - converts AttrValue to string for interpolation
function interpolate(value: string, data: DataObject): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, attrName) => {
    return attrString(data[attrName])
  })
}

// Apply rules to a data object - returns a new DataObject
function applyRules(data: DataObject, rules: MapRule[]): DataObject {
  const newData = { ...data }

  for (const rule of rules) {
    switch (rule.operation) {
      case 'set':
        newData[rule.attrName] = interpolate(rule.value, data)
        break
      case 'add':
        if (!newData[rule.attrName]) {
          newData[rule.attrName] = interpolate(rule.value, data)
        }
        break
      case 'remove':
        delete newData[rule.attrName]
        break
    }
  }

  return newData
}

export function MapSemantic({ entity }: MapSemanticProps) {
  const { project } = useLoaderData() as EditorLoaderData
  const { inputData, inputRelationships } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()

  // Parse rules from entity attrs
  const rules = useMemo(() => parseMapRules(entity.attrs), [entity.attrs])

  // Apply rules to all input data objects
  const transformedData = useMemo((): DataObject[] => {
    return inputData.map((data) => applyRules(data, rules))
  }, [inputData, rules])

  // Register output for downstream composition
  useSemanticOutput(entity.id, {
    data: transformedData,
    relationships: inputRelationships,
  })

  // Add a new rule
  const handleAddRule = useCallback(
    async (operation: 'set' | 'add' | 'remove') => {
      const attrKey = `map.${operation}.newAttr`
      await bl.attrs.set(project.id, entity.id, attrKey, operation === 'remove' ? 'true' : '')
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Update a rule's attr name
  const handleUpdateAttrName = useCallback(
    async (rule: MapRule, newName: string) => {
      // Delete old key, create new one
      await bl.attrs.delete(project.id, entity.id, rule.attrKey)
      const newKey = `map.${rule.operation}.${newName}`
      await bl.attrs.set(project.id, entity.id, newKey, rule.value || 'true')
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Update a rule's value
  const handleUpdateValue = useCallback(
    async (rule: MapRule, newValue: string) => {
      await bl.attrs.set(project.id, entity.id, rule.attrKey, newValue)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Delete a rule
  const handleDeleteRule = useCallback(
    async (rule: MapRule) => {
      await bl.attrs.delete(project.id, entity.id, rule.attrKey)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Change rule operation
  const handleChangeOperation = useCallback(
    async (rule: MapRule, newOperation: 'set' | 'add' | 'remove') => {
      await bl.attrs.delete(project.id, entity.id, rule.attrKey)
      const newKey = `map.${newOperation}.${rule.attrName}`
      await bl.attrs.set(project.id, entity.id, newKey, newOperation === 'remove' ? 'true' : rule.value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  return (
    <div className="map-semantic">
      <div className="map-semantic__header">
        <span className="map-semantic__stats">
          {transformedData.length} {transformedData.length === 1 ? 'entity' : 'entities'}
        </span>
        <span className="map-semantic__rules-count">
          {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
        </span>
      </div>

      <div className="map-semantic__rules">
        {rules.map((rule) => (
          <div key={rule.attrKey} className="map-semantic__rule">
            <Select
              value={rule.operation}
              onValueChange={(v) => handleChangeOperation(rule, v as 'set' | 'add' | 'remove')}
            >
              <SelectTrigger className="map-semantic__operation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="set">set</SelectItem>
                <SelectItem value="add">add</SelectItem>
                <SelectItem value="remove">remove</SelectItem>
              </SelectContent>
            </Select>

            <LocalInput
              value={rule.attrName}
              onCommit={(v) => handleUpdateAttrName(rule, v)}
              placeholder="attr"
              className="map-semantic__attr-name"
            />

            {rule.operation !== 'remove' && (
              <>
                <span className="map-semantic__equals">=</span>
                <LocalInput
                  value={rule.value}
                  onCommit={(v) => handleUpdateValue(rule, v)}
                  placeholder="value"
                  className="map-semantic__value"
                />
              </>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="map-semantic__delete"
              onClick={() => handleDeleteRule(rule)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="map-semantic__add">
        <Label className="map-semantic__add-label">Add rule:</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAddRule('set')}
          className="map-semantic__add-btn"
        >
          <Plus className="h-3 w-3 mr-1" />
          set
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAddRule('add')}
          className="map-semantic__add-btn"
        >
          <Plus className="h-3 w-3 mr-1" />
          add
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAddRule('remove')}
          className="map-semantic__add-btn"
        >
          <Plus className="h-3 w-3 mr-1" />
          remove
        </Button>
      </div>

      {inputData.length === 0 && (
        <div className="map-semantic__empty">
          No input entities. Bind entities or semantics to transform.
        </div>
      )}
    </div>
  )
}
