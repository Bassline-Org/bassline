/**
 * Document Semantic
 *
 * A block semantic for Notion-like document editing.
 * Children are block entities connected via 'contains' relationships.
 *
 * Follows the standard semantic pattern: DataObject[] → DataObject[]
 *
 * Features:
 * - Full keyboard navigation (arrows, tab, enter)
 * - Slash commands for changing block types (handled by TextBlock)
 * - Multiple block types (text, number, boolean, list, object)
 *
 * Configuration:
 * - Children via 'contains' relationships
 * - block.order on children determines ordering
 */

import { useMemo, useCallback, useEffect } from 'react'
import { FileText } from 'lucide-react'
import type { EntityWithAttrs, EditorLoaderData, AttrValue } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import { DocumentProvider } from '../contexts/DocumentContext'
import { getChildEntities, assembleBlockValue } from '../lib/blocks'
import { BlockRenderer } from '../components/blocks/BlockRenderer'

interface DocumentSemanticProps {
  entity: EntityWithAttrs
}

export function DocumentSemantic({ entity }: DocumentSemanticProps) {
  const { project, entities, relationships } = useLoaderData() as EditorLoaderData
  useSemanticInput(entity) // Required for semantic pattern
  const { bl, revalidate } = useBl()

  // Get children
  const children = useMemo(
    () => getChildEntities(entity.id, entities, relationships),
    [entity.id, entities, relationships]
  )

  // Compute assembled value - for document, we serialize block content
  const assembledValue = useMemo(() => {
    return children.map((child) => ({
      type: child.attrs['semantic.type'] || 'text',
      content: assembleBlockValue(child, entities, relationships),
    }))
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
        // Insert at end
        order = children.length
      }

      // Create new entity
      const newEntity = await bl.entities.create(project.id, {})

      // Set attrs based on type
      await bl.attrs.set(project.id, newEntity.id, 'semantic.type', type)
      await bl.attrs.set(project.id, newEntity.id, 'block.order', order)

      // Set default content based on type
      if (type === 'number') {
        await bl.attrs.set(project.id, newEntity.id, 'content', 0)
      } else if (type === 'boolean') {
        await bl.attrs.set(project.id, newEntity.id, 'content', 0)
      } else if (type === 'list' || type === 'object') {
        // Structural types start empty, content computed from children
      } else {
        await bl.attrs.set(project.id, newEntity.id, 'content', '')
      }

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

  // Auto-create first empty block if document is empty
  useEffect(() => {
    if (children.length === 0) {
      handleInsert('text')
    }
  }, []) // Only run once on mount

  return (
    <div className="document-semantic">
      <div className="document-semantic__header flex items-center gap-1 mb-1">
        <FileText className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Document
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
        <div className="document-semantic__blocks space-y-1">
          {children.map((child) => (
            <div key={child.id} className="document-semantic__block">
              <BlockRenderer entity={child} />
            </div>
          ))}
        </div>
      </DocumentProvider>
    </div>
  )
}
