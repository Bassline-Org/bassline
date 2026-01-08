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
import type { EditorLoaderData, EntityWithAttrs } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'

interface JsonExportProps {
  entity: EntityWithAttrs
}

export function JsonExportSemantic({ entity }: JsonExportProps) {
  const { project, entities, relationships } = useLoaderData() as EditorLoaderData
  const { inputEntities, inputRelationships, boundEntityIds } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()
  const [copied, setCopied] = useState(false)

  // Determine scope from config
  const scope = (entity.attrs['json-export.scope'] || 'project') as 'project' | 'bindings'
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

  // Select entities based on scope
  const exportEntities = useMemo(() => {
    if (useBindings) {
      return inputEntities
    }
    // Project scope - filter out semantic nodes
    return entities.filter(e => !e.attrs['semantic.type'])
  }, [useBindings, inputEntities, entities])

  // Select relationships based on scope
  const exportRelationships = useMemo(() => {
    if (useBindings) {
      return inputRelationships
    }
    // Project scope - all relationships between non-semantic entities
    const exportIds = new Set(exportEntities.map(e => e.id))
    return relationships.filter(
      r => exportIds.has(r.from_entity) && exportIds.has(r.to_entity)
    )
  }, [useBindings, inputRelationships, relationships, exportEntities])

  // Register output for downstream composition
  useSemanticOutput(entity.id, {
    entities: exportEntities,
    relationships: exportRelationships,
  })

  const exportData = {
    entities: exportEntities.map(e => ({
      id: e.id,
      attrs: e.attrs,
    })),
    relationships: exportRelationships.map(r => ({
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
          {exportEntities.length} entities, {exportRelationships.length} relationships
        </span>
      </div>
      <pre className="json-export__code">{json}</pre>
    </div>
  )
}
