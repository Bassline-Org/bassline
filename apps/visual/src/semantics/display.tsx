/**
 * Display Semantic
 *
 * Unified visualization of entity data with configurable views.
 * Absorbs the functionality of JSON Export and adds table, code, list views.
 *
 * Configuration:
 * - display.view = "table" | "code" | "json" | "list" (default: "table")
 * - display.columns = "name,role,status" (for table view)
 * - display.attr = "value.string" (for code/markdown view)
 * - display.language = "typescript" (for code view)
 * - display.label = "{{name}} ({{role}})" (for list view)
 * - display.scope = "attrs" | "full" (for json view, default: "attrs")
 * - display.mode = "output" | "direct" (default: "output")
 *   - "output": Show output entities from bound semantics (composition)
 *   - "direct": Show bound entities directly, even semantics (debugging)
 */

import { useMemo, useCallback, useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
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
import type { EntityWithAttrs, DataObject } from '../types'
import { attrString, getAttr } from '../types'
import { useSemanticInput, useDirectBindings } from '../hooks/useSemanticInput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import type { EditorLoaderData } from '../types'

interface DisplaySemanticProps {
  entity: EntityWithAttrs
}

type ViewType = 'table' | 'code' | 'json' | 'list'
type InputMode = 'output' | 'direct'

// Interpolate {{attr}} placeholders - converts AttrValue to string for display
function interpolate(template: string, data: DataObject): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, attrName) => {
    const trimmed = attrName.trim()
    return attrString(data[trimmed])
  })
}

// Local input that persists on blur
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

// Table view component
function TableView({
  data,
  columns,
}: {
  data: DataObject[]
  columns: string[]
}) {
  if (data.length === 0) {
    return <div className="display-semantic__empty">No entities to display</div>
  }

  // If no columns specified, auto-detect from first few data objects
  const displayColumns =
    columns.length > 0
      ? columns
      : Array.from(
          new Set(data.slice(0, 5).flatMap((d) => Object.keys(d)))
        ).slice(0, 5)

  return (
    <div className="display-semantic__table-wrapper">
      <table className="display-semantic__table">
        <thead>
          <tr>
            {displayColumns.map((col) => (
              <th key={col} className="display-semantic__th">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => {
            const id = typeof d.id === 'string' ? d.id : `_${i}`
            return (
              <tr key={id} className="display-semantic__tr">
                {displayColumns.map((col) => (
                  <td key={col} className="display-semantic__td">
                    {attrString(d[col])}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Code view component
function CodeView({
  data,
  attr,
  language,
}: {
  data: DataObject[]
  attr: string
  language: string
}) {
  const [copied, setCopied] = useState(false)

  const code = data
    .map((d) => attrString(d[attr]))
    .filter(Boolean)
    .join('\n\n')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!code) {
    return <div className="display-semantic__empty">No code to display</div>
  }

  return (
    <div className="display-semantic__code-wrapper">
      <div className="display-semantic__code-header">
        <span className="display-semantic__code-lang">{language}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <pre className="display-semantic__code">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// JSON view component - preserves typed values (numbers as numbers, objects as objects)
function JsonView({
  data,
}: {
  data: DataObject[]
}) {
  const [copied, setCopied] = useState(false)

  // For JSON export, data is already typed - numbers stay numbers, objects stay objects
  const json = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="display-semantic__json-wrapper">
      <div className="display-semantic__json-header">
        <span className="display-semantic__json-count">
          {data.length} {data.length === 1 ? 'entity' : 'entities'}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <pre className="display-semantic__json">
        <code>{json}</code>
      </pre>
    </div>
  )
}

// List view component
function ListView({
  data,
  labelTemplate,
}: {
  data: DataObject[]
  labelTemplate: string
}) {
  if (data.length === 0) {
    return <div className="display-semantic__empty">No entities to display</div>
  }

  return (
    <ul className="display-semantic__list">
      {data.map((d, i) => {
        const id = typeof d.id === 'string' ? d.id : `_${i}`
        return (
          <li key={id} className="display-semantic__list-item">
            {labelTemplate
              ? interpolate(labelTemplate, d)
              : getAttr(d, 'name', id.slice(0, 8))}
          </li>
        )
      })}
    </ul>
  )
}

export function DisplaySemantic({ entity }: DisplaySemanticProps) {
  const { project } = useLoaderData() as EditorLoaderData
  const { bl, revalidate } = useBl()

  // Get input mode - determines how bound entities are resolved
  const inputMode = getAttr(entity.attrs, 'display.mode', 'output') as InputMode

  // Call both hooks (can't conditionally call hooks)
  const { inputData: outputData } = useSemanticInput(entity)
  const directEntities = useDirectBindings(entity)

  // Select data based on mode
  // For direct mode, we use the entity's attrs (which IS a DataObject)
  const inputData = useMemo((): DataObject[] => {
    if (inputMode === 'direct') {
      return directEntities.map(e => e.attrs)
    }
    return outputData
  }, [inputMode, directEntities, outputData])

  // Get configuration
  const view = getAttr(entity.attrs, 'display.view', 'table') as ViewType
  const columns = getAttr(entity.attrs, 'display.columns')
  const attr = getAttr(entity.attrs, 'display.attr', 'value.string')
  const language = getAttr(entity.attrs, 'display.language', 'text')
  const labelTemplate = getAttr(entity.attrs, 'display.label')
  const scope = getAttr(entity.attrs, 'display.scope', 'attrs')

  // Parse columns
  const columnList = useMemo(
    () =>
      columns
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    [columns]
  )

  // Update handlers
  const handleViewChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'display.view', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleColumnsChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'display.columns', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleAttrChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'display.attr', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleLanguageChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'display.language', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleLabelChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'display.label', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleScopeChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'display.scope', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleModeChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'display.mode', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  return (
    <div className="display-semantic">
      <div className="display-semantic__config">
        <div className="display-semantic__row">
          <div className="display-semantic__field">
            <Label className="display-semantic__label">View</Label>
            <Select value={view} onValueChange={handleViewChange}>
              <SelectTrigger className="display-semantic__select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="list">List</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="display-semantic__field">
            <Label className="display-semantic__label">Input</Label>
            <Select value={inputMode} onValueChange={handleModeChange}>
              <SelectTrigger className="display-semantic__select--small">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="output">Output</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {view === 'table' && (
          <div className="display-semantic__field">
            <Label className="display-semantic__label">Columns</Label>
            <LocalInput
              value={columns}
              onCommit={handleColumnsChange}
              placeholder="name,role,status (auto if empty)"
              className="display-semantic__input"
            />
          </div>
        )}

        {view === 'code' && (
          <>
            <div className="display-semantic__field display-semantic__field--inline">
              <Label className="display-semantic__label">Attr:</Label>
              <LocalInput
                value={attr}
                onCommit={handleAttrChange}
                placeholder="value.string"
                className="display-semantic__input--small"
              />
            </div>
            <div className="display-semantic__field display-semantic__field--inline">
              <Label className="display-semantic__label">Language:</Label>
              <LocalInput
                value={language}
                onCommit={handleLanguageChange}
                placeholder="typescript"
                className="display-semantic__input--small"
              />
            </div>
          </>
        )}

        {view === 'json' && (
          <div className="display-semantic__field">
            <Label className="display-semantic__label">Scope</Label>
            <Select value={scope} onValueChange={handleScopeChange}>
              <SelectTrigger className="display-semantic__select--small">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attrs">Attrs only</SelectItem>
                <SelectItem value="full">Full entities</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {view === 'list' && (
          <div className="display-semantic__field">
            <Label className="display-semantic__label">Label template</Label>
            <LocalInput
              value={labelTemplate}
              onCommit={handleLabelChange}
              placeholder="{{name}} ({{role}})"
              className="display-semantic__input"
            />
          </div>
        )}
      </div>

      <div className="display-semantic__content">
        {view === 'table' && (
          <TableView data={inputData} columns={columnList} />
        )}
        {view === 'code' && (
          <CodeView data={inputData} attr={attr} language={language} />
        )}
        {view === 'json' && <JsonView data={inputData} />}
        {view === 'list' && (
          <ListView data={inputData} labelTemplate={labelTemplate} />
        )}
      </div>

      {inputData.length === 0 && (
        <div className="display-semantic__empty">
          No input entities. Bind entities or semantics to display.
        </div>
      )}
    </div>
  )
}
