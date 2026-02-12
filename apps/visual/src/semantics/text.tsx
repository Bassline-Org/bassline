/**
 * Text Semantic
 *
 * A block semantic for editing text values.
 * Follows the standard semantic pattern: DataObject[] → DataObject[]
 *
 * Configuration:
 * - content: string value to edit
 *
 * Output:
 * - Single DataObject with the entity's attrs + computed content
 */

import { useMemo, useCallback } from 'react'
import { Type } from 'lucide-react'
import type { EntityWithAttrs, EditorLoaderData } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import { TextBlock } from '../components/blocks/TextBlock'

interface TextSemanticProps {
  entity: EntityWithAttrs
}

export function TextSemantic({ entity }: TextSemanticProps) {
  const { project } = useLoaderData() as EditorLoaderData
  useSemanticInput(entity) // Required for semantic pattern
  const { bl, revalidate } = useBl()

  // Get current content
  const content = entity.attrs['content']
  const contentString = typeof content === 'string' ? content : String(content ?? '')

  // Handle content change
  const handleChange = useCallback(
    async (value: string | number | object | ArrayBuffer) => {
      await bl.attrs.set(project.id, entity.id, 'content', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Build output DataObject
  const outputData = useMemo(() => {
    return [
      {
        id: entity.id,
        ...entity.attrs,
        content: contentString,
      },
    ]
  }, [entity.id, entity.attrs, contentString])

  // Register output
  useSemanticOutput(entity.id, {
    data: outputData,
    relationships: [],
  })

  return (
    <div className="text-semantic">
      <div className="text-semantic__header">
        <Type className="h-4 w-4" />
        <span className="text-xs text-muted-foreground">Text</span>
      </div>
      <TextBlock
        entity={entity}
        value={contentString}
        onChange={handleChange}
        className="text-semantic__input"
      />
    </div>
  )
}
