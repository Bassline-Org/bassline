/**
 * JSON Export Semantic
 *
 * Displays entities and relationships as JSON.
 * Supports two modes:
 * - project: All entities (default)
 * - bindings: Only entities that bind to this semantic
 *
 * Configuration:
 * - json-export.scope: "project" | "bindings"
 */

import { useState, useMemo, useCallback } from 'react'
import { useLoaderData } from 'react-router'
import { Copy, Check, Globe, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { EditorLoaderData, EntityWithAttrs, DataObject } from '../types'
import { getAttr } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'

interface JsonExportProps {
  entity: EntityWithAttrs
}

export function JsonExportSemantic({ entity }: JsonExportProps) {
  const { project, entities, relationships } = useLoaderData() as EditorLoaderData
  const { inputData, inputRelationships, boundEntityIds } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()
  const [copied, setCopied] = useState(false)

  // Determine scope from config
  const scope = getAttr(entity.attrs, 'json-export.scope', 'project') as 'project' | 'bindings'
  const useBindings = scope === 'bindings' && boundEntityIds.length > 0

  const handleScopeChange = useCallback(
    async (value: string) => {
      if (value && (value === 'project' || value === 'bindings')) {
        await bl.attrs.set(project.id, entity.id, 'json-export.scope', value)
        revalidate()
      }
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Select data based on scope - preserves typed values for export
  const exportData = useMemo((): DataObject[] => {
    if (useBindings) {
      return inputData
    }
    // Project scope - filter out semantic nodes, use attrs (which is DataObject)
    return entities
      .filter(e => !e.attrs['semantic.type'])
      .map(e => e.attrs)
  }, [useBindings, inputData, entities])

  // Select relationships based on scope
  const exportRelationships = useMemo(() => {
    if (useBindings) {
      return inputRelationships
    }
    // Project scope - all relationships between non-semantic entities
    const exportIds = new Set(
      exportData
        .map(d => d.id)
        .filter((id): id is string => typeof id === 'string')
    )
    return relationships.filter(
      r => exportIds.has(r.from_entity) && exportIds.has(r.to_entity)
    )
  }, [useBindings, inputRelationships, relationships, exportData])

  // Register output for downstream composition
  useSemanticOutput(entity.id, {
    data: exportData,
    relationships: exportRelationships,
  })

  // Build export structure - preserves typed values (numbers as numbers, objects as objects)
  const exportStructure = {
    entities: exportData.map(data => ({
      id: data.id,
      attrs: data,
    })),
    relationships: exportRelationships.map(r => ({
      id: r.id,
      from: r.from_entity,
      to: r.to_entity,
      kind: r.kind,
      label: r.label,
    })),
  }

  const json = JSON.stringify(exportStructure, null, 2)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="json-export">
      <div className="json-export__actions">
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={handleScopeChange}
          className="json-export__scope-toggle"
        >
          <ToggleGroupItem value="project" aria-label="Project scope" title="Export all entities">
            <Globe className="w-3 h-3" />
          </ToggleGroupItem>
          <ToggleGroupItem value="bindings" aria-label="Bindings scope" title="Export only bound entities">
            <Link2 className="w-3 h-3" />
          </ToggleGroupItem>
        </ToggleGroup>
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
          {exportData.length} entities, {exportRelationships.length} relationships
        </span>
      </div>
      <pre className="json-export__code">{json}</pre>
    </div>
  )
}
