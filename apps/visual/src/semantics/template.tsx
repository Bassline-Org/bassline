/**
 * Template Combinator
 *
 * Generates text/code and stores it as an attribute on each entity.
 *
 * Configuration:
 * - template.content = template string with {{attr}} placeholders
 * - template.output = attr name to store result (default: value.string)
 */

import { useMemo, useCallback, useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EntityWithAttrs } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import type { EditorLoaderData } from '../types'

interface TemplateSemanticProps {
  entity: EntityWithAttrs
}

// Simple {{attr}} interpolation
function interpolateTemplate(template: string, attrs: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, attrName) => {
    const trimmed = attrName.trim()
    return attrs[trimmed] ?? ''
  })
}

// Apply template to entity, storing result in output attr
function applyTemplate(
  entity: EntityWithAttrs,
  template: string,
  outputAttr: string
): EntityWithAttrs {
  const result = interpolateTemplate(template, entity.attrs)
  return {
    ...entity,
    attrs: {
      ...entity.attrs,
      [outputAttr]: result,
    },
  }
}

// Local textarea that persists on blur to avoid focus loss
function LocalTextarea({
  value,
  onCommit,
  placeholder,
  className,
  rows,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  className?: string
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
      className={className}
      rows={rows}
    />
  )
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

export function TemplateSemantic({ entity }: TemplateSemanticProps) {
  const { project } = useLoaderData() as EditorLoaderData
  const { inputEntities, inputRelationships } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()
  const [copied, setCopied] = useState(false)

  // Get configuration
  const templateContent = entity.attrs['template.content'] || ''
  const outputAttr = entity.attrs['template.output'] || 'value.string'

  // Apply template to all input entities
  const transformedEntities = useMemo(() => {
    if (!templateContent) return inputEntities
    return inputEntities.map((e) => applyTemplate(e, templateContent, outputAttr))
  }, [inputEntities, templateContent, outputAttr])

  // Get all generated outputs for preview
  const generatedOutputs = useMemo(() => {
    return transformedEntities.map((e) => ({
      id: e.id,
      name: e.attrs.name || e.id.slice(0, 8),
      output: e.attrs[outputAttr] || '',
    }))
  }, [transformedEntities, outputAttr])

  // Register output for downstream composition
  useSemanticOutput(entity.id, {
    entities: transformedEntities,
    relationships: inputRelationships,
  })

  // Update template content
  const handleTemplateChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'template.content', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Update output attr name
  const handleOutputAttrChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'template.output', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Copy all outputs
  const handleCopyAll = useCallback(async () => {
    const allOutputs = generatedOutputs.map((o) => o.output).join('\n\n')
    await navigator.clipboard.writeText(allOutputs)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedOutputs])

  return (
    <div className="template-semantic">
      <div className="template-semantic__config">
        <div className="template-semantic__field">
          <Label className="template-semantic__label">Template</Label>
          <LocalTextarea
            value={templateContent}
            onCommit={handleTemplateChange}
            placeholder="interface {{name}} { id: string; }"
            className="template-semantic__textarea"
            rows={4}
          />
        </div>

        <div className="template-semantic__field template-semantic__field--inline">
          <Label className="template-semantic__label">Output attr:</Label>
          <LocalInput
            value={outputAttr}
            onCommit={handleOutputAttrChange}
            placeholder="value.string"
            className="template-semantic__output-attr"
          />
        </div>
      </div>

      <div className="template-semantic__preview">
        <div className="template-semantic__preview-header">
          <span className="template-semantic__preview-title">
            Preview ({generatedOutputs.length})
          </span>
          {generatedOutputs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="template-semantic__copy-btn"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy all
                </>
              )}
            </Button>
          )}
        </div>

        <div className="template-semantic__outputs">
          {generatedOutputs.slice(0, 5).map((o) => (
            <div key={o.id} className="template-semantic__output">
              <div className="template-semantic__output-name">{o.name}</div>
              <pre className="template-semantic__output-code">{o.output || '(empty)'}</pre>
            </div>
          ))}
          {generatedOutputs.length > 5 && (
            <div className="template-semantic__more">
              +{generatedOutputs.length - 5} more
            </div>
          )}
          {generatedOutputs.length === 0 && (
            <div className="template-semantic__empty">
              No input entities. Bind entities or semantics to generate from.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
