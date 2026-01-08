/**
 * Object Semantic
 *
 * A block semantic for editing object/dictionary values.
 * Children are entities connected via 'contains' relationships, each with a 'key' attr.
 *
 * Follows the standard semantic pattern: DataObject[] → DataObject[]
 *
 * The object's content is computed by assembling child values:
 * - Each child has a 'key' attr and a 'content' attr
 * - Output is [{ id, content: { key1: value1, key2: value2, ... } }]
 *
 * Configuration:
 * - Children via 'contains' relationships
 * - Each child has 'key' attr for the field name
 * - block.order on children determines display ordering
 */

import { useMemo, useCallback, useState } from 'react'
import { Braces, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EntityWithAttrs, EditorLoaderData, AttrValue } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import { DocumentProvider } from '../contexts/DocumentContext'
import { getChildEntities, assembleBlockValue, getBlockKey } from '../lib/blocks'
import { BlockRenderer } from '../components/blocks/BlockRenderer'

interface ObjectSemanticProps {
  entity: EntityWithAttrs
}

export function ObjectSemantic({ entity }: ObjectSemanticProps) {
  const { project, entities, relationships } = useLoaderData() as EditorLoaderData
  useSemanticInput(entity) // Required for semantic pattern
  const { bl, revalidate } = useBl()

  // State for new key input
  const [newKey, setNewKey] = useState('')

  // Get children
  const children = useMemo(
    () => getChildEntities(entity.id, entities, relationships),
    [entity.id, entities, relationships]
  )

  // Compute assembled value as object
  const assembledValue = useMemo(() => {
    const result: Record<string, AttrValue> = {}
    for (const child of children) {
      const key = getBlockKey(child)
      if (key) {
        result[key] = assembleBlockValue(child, entities, relationships)
      }
    }
    return result
  }, [children, entities, relationships])

  // Build output DataObject
  const outputData = useMemo(() => {
    return [
      {
        id: entity.id,
        ...entity.attrs,
        content: assembledValue,
      },
    ]
  }, [entity.id, entity.attrs, assembledValue])

  // Register output
  useSemanticOutput(entity.id, {
    data: outputData,
    relationships: [],
  })

  // Mutation callbacks for DocumentProvider
  const handleInsert = useCallback(
    async (type: string, afterId?: string, parentId?: string) => {
      const targetParent = parentId ?? entity.id

      // Determine order
      let order = 0
      if (afterId) {
        const afterEntity = entities.find((e) => e.id === afterId)
        if (afterEntity) {
          order = (afterEntity.attrs['block.order'] as number ?? 0) + 1
        }
      } else {
        order = children.length
      }

      // Create new entity
      const newEntity = await bl.entities.create(project.id, {})

      // Set attrs
      await bl.attrs.set(project.id, newEntity.id, 'semantic.type', type)
      await bl.attrs.set(project.id, newEntity.id, 'block.order', order)
      await bl.attrs.set(project.id, newEntity.id, 'content', type === 'number' ? 0 : '')
      // Auto-generate a key for new fields
      await bl.attrs.set(project.id, newEntity.id, 'key', `field${order}`)

      // Create contains relationship
      await bl.relationships.create(project.id, {
        from_entity: targetParent,
        to_entity: newEntity.id,
        kind: 'contains',
      })

      revalidate()
      return newEntity.id
    },
    [bl, project.id, entity.id, entities, children, revalidate]
  )

  const handleDelete = useCallback(
    async (blockId: string) => {
      await bl.entities.delete(project.id, blockId)
      revalidate()
    },
    [bl, project.id, revalidate]
  )

  const handleUpdate = useCallback(
    async (blockId: string, content: AttrValue) => {
      await bl.attrs.set(project.id, blockId, 'content', content)
      revalidate()
    },
    [bl, project.id, revalidate]
  )

  const handleUpdateAttr = useCallback(
    async (blockId: string, key: string, value: AttrValue) => {
      await bl.attrs.set(project.id, blockId, key, value)
      revalidate()
    },
    [bl, project.id, revalidate]
  )

  const handleChangeType = useCallback(
    async (blockId: string, newType: string) => {
      // Change semantic.type and clear content for type change
      await bl.attrs.set(project.id, blockId, 'semantic.type', newType)
      // Clear content for non-text types
      if (newType === 'number') {
        await bl.attrs.set(project.id, blockId, 'content', 0)
      } else if (newType === 'boolean') {
        await bl.attrs.set(project.id, blockId, 'content', 0)
      } else if (newType !== 'text') {
        await bl.attrs.set(project.id, blockId, 'content', '')
      }
      revalidate()
    },
    [bl, project.id, revalidate]
  )

  // Handle adding new field with specific key
  const handleAddField = useCallback(async () => {
    if (!newKey.trim()) return

    // Check if key already exists
    const existingKeys = children.map((c) => getBlockKey(c))
    if (existingKeys.includes(newKey.trim())) {
      return // Key already exists
    }

    // Create new child with key
    const newId = await handleInsert('text')
    await bl.attrs.set(project.id, newId, 'key', newKey.trim())
    setNewKey('')
    revalidate()
  }, [newKey, children, handleInsert, bl, project.id, revalidate])

  // Handle key input keyboard
  const handleKeyInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddField()
    }
    if (e.key === 'Escape') {
      setNewKey('')
    }
  }

  return (
    <div className="object-semantic">
      <div className="object-semantic__header flex items-center gap-1 mb-1">
        <Braces className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Object
        </span>
      </div>

      <DocumentProvider
        documentId={entity.id}
        entities={entities}
        relationships={relationships}
        onInsert={handleInsert}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        onUpdateAttr={handleUpdateAttr}
        onChangeType={handleChangeType}
      >
        <div className="object-semantic__fields space-y-1">
          {children.map((child) => {
            const key = getBlockKey(child) ?? child.id.slice(0, 8)

            return (
              <div key={child.id} className="object-semantic__field flex items-start gap-2">
                <span className="text-muted-foreground text-xs font-medium min-w-16 pt-2 flex-shrink-0">
                  {key}:
                </span>
                <div className="flex-1 min-w-0">
                  <BlockRenderer entity={child} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 opacity-0 hover:opacity-100"
                  onClick={() => handleDelete(child.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>

        {/* Key input for adding new fields */}
        <div className="object-semantic__add mt-2">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={handleKeyInputKeyDown}
            placeholder="Add field... (type name, press Enter)"
            className="h-7 text-xs"
          />
        </div>
      </DocumentProvider>
    </div>
  )
}
