/**
 * Number Semantic
 *
 * A block semantic for editing numeric values.
 * Follows the standard semantic pattern: DataObject[] → DataObject[]
 *
 * Configuration:
 * - content: number value to edit
 *
 * Output:
 * - Single DataObject with the entity's attrs + computed content (as number)
 */

import { useMemo, useCallback } from 'react'
import { Hash } from 'lucide-react'
import type { EntityWithAttrs, EditorLoaderData } from '../types'
import { attrNumber } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import { NumberBlock } from '../components/blocks/NumberBlock'

interface NumberSemanticProps {
  entity: EntityWithAttrs
}

export function NumberSemantic({ entity }: NumberSemanticProps) {
  const { project } = useLoaderData() as EditorLoaderData
  useSemanticInput(entity) // Required for semantic pattern
  const { bl, revalidate } = useBl()

  // Get current content as number
  const content = entity.attrs['content']
  const contentNumber = attrNumber(content, 0)

  // Handle content change
  const handleChange = useCallback(
    async (value: string | number | object | ArrayBuffer) => {
      // Ensure we store as number
      const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0
      await bl.attrs.set(project.id, entity.id, 'content', numValue)
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
        content: contentNumber,
      },
    ]
  }, [entity.id, entity.attrs, contentNumber])

  // Register output
  useSemanticOutput(entity.id, {
    data: outputData,
    relationships: [],
  })

  return (
    <div className="number-semantic">
      <div className="number-semantic__header">
        <Hash className="h-4 w-4" />
        <span className="text-xs text-muted-foreground">Number</span>
      </div>
      <NumberBlock
        entity={entity}
        value={contentNumber}
        onChange={handleChange}
        className="number-semantic__input"
      />
    </div>
  )
}
