/**
 * Template Semantic
 *
 * Generates text/code using Handlebars templates.
 *
 * MODES:
 *
 * MAP MODE (default): N inputs → N outputs
 * - Applies template to each input entity individually
 * - template.content = template string with {{attr}} placeholders
 * - template.output = attr name to store result (default: value.string)
 *
 * REDUCE MODE: N inputs → 1 output
 * - Aggregates all inputs into a single output entity
 * - template.mode = "reduce"
 * - template.reduce.template = Handlebars template with {{#each items}}
 * - template.reduce.output = attr name for aggregated result (default: content)
 * - template.reduce.name = name for the single output entity (default: generated)
 *
 * HANDLEBARS CONTEXT:
 *
 * Map mode: { ...entity.attrs }
 *
 * Reduce mode: {
 *   items: EntityWithAttrs[],  // All input entities
 *   count: number,             // Number of inputs
 *   first: EntityWithAttrs,    // First input
 *   last: EntityWithAttrs,     // Last input
 * }
 */

import { useMemo, useCallback, useState, useEffect } from 'react'
import { Copy, Check, Layers, FileText } from 'lucide-react'
import Handlebars from 'handlebars'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EntityWithAttrs, DataObject } from '../types'
import { attrString, getAttr } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import type { EditorLoaderData } from '../types'

interface TemplateSemanticProps {
  entity: EntityWithAttrs
}

// Register custom Handlebars helpers
Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context, null, 2)
})

Handlebars.registerHelper('join', function(array, separator) {
  if (!Array.isArray(array)) return ''
  return array.join(separator || ', ')
})

// Apply map-mode template to data object using Handlebars
// Handlebars receives typed values - numbers, strings, objects all work
function applyMapTemplate(
  input: DataObject,
  template: string,
  outputAttr: string
): DataObject {
  try {
    const compiled = Handlebars.compile(template)
    const result = compiled(input)
    return {
      ...input,
      [outputAttr]: result,
    }
  } catch {
    // On template error, return data unchanged
    return input
  }
}

// Apply reduce-mode template to all data objects
function applyReduceTemplate(
  inputData: DataObject[],
  template: string,
  outputAttr: string,
  outputName: string
): DataObject {
  const context = {
    items: inputData,           // Direct DataObject array
    count: inputData.length,
    first: inputData[0] || null,
    last: inputData[inputData.length - 1] || null,
  }

  try {
    const compiled = Handlebars.compile(template)
    const result = compiled(context)
    return {
      id: `reduce-${Date.now()}`,
      name: outputName,
      [outputAttr]: result,
    }
  } catch (err) {
    // On template error, return data with error message
    return {
      id: `reduce-${Date.now()}`,
      name: outputName,
      [outputAttr]: `Template error: ${err instanceof Error ? err.message : String(err)}`,
    }
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
  const { inputData, inputRelationships } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()
  const [copied, setCopied] = useState(false)

  // Get configuration
  const mode = getAttr(entity.attrs, 'template.mode', 'map')

  // Map mode config
  const templateContent = getAttr(entity.attrs, 'template.content')
  const outputAttr = getAttr(entity.attrs, 'template.output', 'value.string')

  // Reduce mode config
  const reduceTemplate = getAttr(entity.attrs, 'template.reduce.template')
  const reduceOutputAttr = getAttr(entity.attrs, 'template.reduce.output', 'content')
  const reduceOutputName = getAttr(entity.attrs, 'template.reduce.name', 'generated')

  // Apply template based on mode
  const outputData = useMemo((): DataObject[] => {
    if (mode === 'reduce') {
      if (!reduceTemplate || inputData.length === 0) {
        return []
      }
      const reduced = applyReduceTemplate(inputData, reduceTemplate, reduceOutputAttr, reduceOutputName)
      return [reduced]
    }

    // Map mode
    if (!templateContent) return inputData
    return inputData.map((data) => applyMapTemplate(data, templateContent, outputAttr))
  }, [mode, inputData, templateContent, outputAttr, reduceTemplate, reduceOutputAttr, reduceOutputName])

  // Get all generated outputs for preview
  const generatedOutputs = useMemo(() => {
    const attr = mode === 'reduce' ? reduceOutputAttr : outputAttr
    return outputData.map((data, i) => {
      const id = typeof data.id === 'string' ? data.id : `_${i}`
      return {
        id,
        name: getAttr(data, 'name', id.slice(0, 8)),
        output: attrString(data[attr]),
      }
    })
  }, [outputData, mode, outputAttr, reduceOutputAttr])

  // Register output for downstream composition
  useSemanticOutput(entity.id, {
    data: outputData,
    relationships: mode === 'reduce' ? [] : inputRelationships,
  })

  // Mode change handler
  const handleModeChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'template.mode', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Map mode: Update template content
  const handleTemplateChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'template.content', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Map mode: Update output attr name
  const handleOutputAttrChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'template.output', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Reduce mode: Update reduce template
  const handleReduceTemplateChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'template.reduce.template', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Reduce mode: Update output attr
  const handleReduceOutputAttrChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'template.reduce.output', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Reduce mode: Update output name
  const handleReduceOutputNameChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'template.reduce.name', value)
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

  const isReduceMode = mode === 'reduce'

  return (
    <div className="template-semantic">
      <div className="template-semantic__header">
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger className="template-semantic__mode-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="map">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Map (N → N)
              </div>
            </SelectItem>
            <SelectItem value="reduce">
              <div className="flex items-center gap-2">
                <Layers className="w-3 h-3" />
                Reduce (N → 1)
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="template-semantic__config">
        {isReduceMode ? (
          // Reduce mode config
          <>
            <div className="template-semantic__field">
              <Label className="template-semantic__label">
                Template (Handlebars)
              </Label>
              <LocalTextarea
                value={reduceTemplate}
                onCommit={handleReduceTemplateChange}
                placeholder={"{{#each items}}\nexport * from './{{attrs.name}}'\n{{/each}}"}
                className="template-semantic__textarea"
                rows={5}
              />
              <div className="template-semantic__hint">
                Context: items, count, first, last. Access attrs via {'{{attrs.name}}'}
              </div>
            </div>

            <div className="template-semantic__row">
              <div className="template-semantic__field template-semantic__field--inline">
                <Label className="template-semantic__label">Output attr:</Label>
                <LocalInput
                  value={reduceOutputAttr}
                  onCommit={handleReduceOutputAttrChange}
                  placeholder="content"
                  className="template-semantic__output-attr"
                />
              </div>

              <div className="template-semantic__field template-semantic__field--inline">
                <Label className="template-semantic__label">Name:</Label>
                <LocalInput
                  value={reduceOutputName}
                  onCommit={handleReduceOutputNameChange}
                  placeholder="generated"
                  className="template-semantic__output-attr"
                />
              </div>
            </div>
          </>
        ) : (
          // Map mode config
          <>
            <div className="template-semantic__field">
              <Label className="template-semantic__label">Template (Handlebars)</Label>
              <LocalTextarea
                value={templateContent}
                onCommit={handleTemplateChange}
                placeholder="interface {{name}} { id: string; }"
                className="template-semantic__textarea"
                rows={4}
              />
              <div className="template-semantic__hint">
                Access entity attrs directly: {'{{name}}'}, {'{{role}}'}, etc.
              </div>
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
          </>
        )}
      </div>

      <div className="template-semantic__preview">
        <div className="template-semantic__preview-header">
          <span className="template-semantic__preview-title">
            {isReduceMode
              ? `Output (${inputData.length} → 1)`
              : `Preview (${generatedOutputs.length})`}
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
                  Copy
                </>
              )}
            </Button>
          )}
        </div>

        <div className="template-semantic__outputs">
          {generatedOutputs.slice(0, 5).map((output) => (
            <div key={output.id} className="template-semantic__output">
              <div className="template-semantic__output-name">{output.name}</div>
              <pre className="template-semantic__output-code">{output.output || '(empty)'}</pre>
            </div>
          ))}
          {generatedOutputs.length > 5 && (
            <div className="template-semantic__more">
              +{generatedOutputs.length - 5} more
            </div>
          )}
          {generatedOutputs.length === 0 && (
            <div className="template-semantic__empty">
              {isReduceMode
                ? 'No input entities. Bind entities or semantics to aggregate.'
                : 'No input entities. Bind entities or semantics to generate from.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
