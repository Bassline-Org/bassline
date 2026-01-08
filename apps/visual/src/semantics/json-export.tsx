/**
 * JSON Export Semantic
 *
 * Displays project entities and relationships as JSON.
 * Uses existing hooks to access project data.
 */

import { useState } from 'react'
import { useLoaderData } from 'react-router'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EditorLoaderData, EntityWithAttrs } from '../types'

interface JsonExportProps {
  entity: EntityWithAttrs
}

export function JsonExportSemantic({ entity: _entity }: JsonExportProps) {
  const { entities, relationships } = useLoaderData() as EditorLoaderData
  const [copied, setCopied] = useState(false)

  // Filter out the semantic node itself from the export
  const exportEntities = entities.filter(e => !e.attrs['semantic.type'])

  const exportData = {
    entities: exportEntities.map(e => ({
      id: e.id,
      attrs: e.attrs,
    })),
    relationships: relationships.map(r => ({
      id: r.id,
      from: r.from_entity,
      to: r.to_entity,
      kind: r.kind,
      label: r.label,
    })),
  }

  const json = JSON.stringify(exportData, null, 2)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="json-export">
      <div className="json-export__actions">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="json-export__copy-btn"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              Copy JSON
            </>
          )}
        </Button>
        <span className="json-export__stats">
          {exportEntities.length} entities, {relationships.length} relationships
        </span>
      </div>
      <pre className="json-export__code">{json}</pre>
    </div>
  )
}
