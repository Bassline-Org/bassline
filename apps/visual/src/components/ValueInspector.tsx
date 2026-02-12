/**
 * ValueInspector
 *
 * Expandable tree view for inspecting values.
 * Handles primitives, objects, arrays, and borth-specific types.
 */

import { useState, memo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValueInspectorProps {
  value: unknown
  name?: string
  depth?: number
  defaultExpanded?: boolean
}

function getValueType(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    // Borth word
    if (obj.rt && obj.attributes) {
      return 'word'
    }
    // Stream/Stack
    if ('data' in obj && Array.isArray(obj.data)) {
      return 'stream'
    }
    return 'object'
  }
  return typeof v
}

function getPreview(v: unknown, type: string): string {
  switch (type) {
    case 'null':
      return 'null'
    case 'undefined':
      return 'undefined'
    case 'string':
      return `"${String(v).slice(0, 50)}${String(v).length > 50 ? '...' : ''}"`
    case 'number':
    case 'boolean':
      return String(v)
    case 'function':
      return 'fn()'
    case 'array':
      return `Array(${(v as unknown[]).length})`
    case 'word': {
      const obj = v as Record<string, unknown>
      const attrs = obj.attributes as Record<string, unknown>
      return attrs.name ? `<${attrs.name}>` : `<${attrs.type || 'word'}>`
    }
    case 'stream': {
      const obj = v as { data: unknown[] }
      return `Stream(${obj.data.length})`
    }
    case 'object': {
      const keys = Object.keys(v as object)
      return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`
    }
    default:
      return String(v)
  }
}

function isExpandable(type: string): boolean {
  return ['array', 'object', 'word', 'stream'].includes(type)
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'string':
      return 'text-green-600 dark:text-green-400'
    case 'number':
      return 'text-blue-600 dark:text-blue-400'
    case 'boolean':
      return 'text-purple-600 dark:text-purple-400'
    case 'null':
    case 'undefined':
      return 'text-gray-500'
    case 'function':
      return 'text-yellow-600 dark:text-yellow-400'
    case 'word':
      return 'text-orange-600 dark:text-orange-400'
    case 'stream':
      return 'text-cyan-600 dark:text-cyan-400'
    default:
      return ''
  }
}

const ValueNode = memo(function ValueNode({
  value,
  name,
  depth = 0,
  defaultExpanded = false,
  ancestors,
}: ValueInspectorProps & { ancestors: Set<unknown> }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const type = getValueType(value)
  const expandable = isExpandable(type)
  const preview = getPreview(value, type)
  const typeColor = getTypeColor(type)

  // Check for circular reference - only if this object is in our ancestor chain
  const isCircular = typeof value === 'object' && value !== null && ancestors.has(value)

  // Get children for expandable types
  const getChildren = (): Array<{ key: string; value: unknown }> => {
    if (isCircular) return []

    if (type === 'array') {
      return (value as unknown[]).map((v, i) => ({ key: String(i), value: v }))
    }
    if (type === 'stream') {
      const stream = value as { data: unknown[] }
      return stream.data.map((v, i) => ({ key: String(i), value: v }))
    }
    if (type === 'word') {
      const word = value as Record<string, unknown>
      const attrs = word.attributes as Record<string, unknown>
      return Object.entries(attrs).map(([k, v]) => ({ key: k, value: v }))
    }
    if (type === 'object') {
      return Object.entries(value as object).map(([k, v]) => ({ key: k, value: v }))
    }
    return []
  }

  // Create new ancestor set including this value for children
  const childAncestors = new Set(ancestors)
  if (typeof value === 'object' && value !== null) {
    childAncestors.add(value)
  }

  const children = expanded ? getChildren() : []
  const indent = depth * 12

  return (
    <div className="select-text">
      <div
        className={cn(
          'flex items-start gap-1 py-0.5 hover:bg-muted/50 rounded cursor-default',
          expandable && 'cursor-pointer'
        )}
        style={{ paddingLeft: indent }}
        onClick={expandable ? () => setExpanded(!expanded) : undefined}
      >
        {/* Expand/collapse icon */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {expandable && !isCircular && (
            expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )
          )}
        </span>

        {/* Name/key */}
        {name !== undefined && (
          <>
            <span className="text-purple-700 dark:text-purple-300">{name}</span>
            <span className="text-muted-foreground">:</span>
          </>
        )}

        {/* Value preview */}
        {isCircular ? (
          <span className="text-red-500 italic">[Circular]</span>
        ) : expandable && expanded ? (
          <span className="text-muted-foreground">
            {type === 'array' ? '[' : type === 'stream' ? 'Stream [' : '{'}
          </span>
        ) : (
          <span className={cn('break-all', typeColor)}>{preview}</span>
        )}

        {/* Type badge for complex types */}
        {!expanded && expandable && !isCircular && (
          <span className="text-muted-foreground text-[10px] ml-1">
            {type === 'word' && 'word'}
            {type === 'stream' && 'stream'}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && !isCircular && children.length > 0 && (
        <div>
          {children.map(({ key, value: childValue }) => (
            <ValueNode
              key={key}
              name={key}
              value={childValue}
              depth={depth + 1}
              ancestors={childAncestors}
            />
          ))}
          {/* Closing bracket */}
          <div
            className="text-muted-foreground py-0.5"
            style={{ paddingLeft: indent + 16 }}
          >
            {type === 'array' || type === 'stream' ? ']' : '}'}
          </div>
        </div>
      )}

      {/* Empty indicator */}
      {expanded && !isCircular && children.length === 0 && (
        <div
          className="text-muted-foreground italic py-0.5"
          style={{ paddingLeft: indent + 16 }}
        >
          empty
        </div>
      )}
    </div>
  )
})

export function ValueInspector({ value, name, depth = 0, defaultExpanded = true }: ValueInspectorProps) {
  // Create empty ancestor set for top-level
  const ancestors = new Set<unknown>()
  return (
    <ValueNode
      value={value}
      name={name}
      depth={depth}
      defaultExpanded={defaultExpanded}
      ancestors={ancestors}
    />
  )
}

/**
 * StackInspector - Shows all stack values with indices
 * TOS (top of stack) is displayed at the top
 */
export function StackInspector({ stack }: { stack: unknown[] }) {
  if (stack.length === 0) {
    return <div className="text-xs text-muted-foreground italic p-2">empty</div>
  }

  // Reverse so TOS (last element) is shown first
  const reversed = [...stack].reverse()

  return (
    <div className="font-mono text-xs p-1">
      {reversed.map((value, displayIdx) => {
        const stackIdx = stack.length - 1 - displayIdx // actual stack index
        return (
          <div key={stackIdx} className="border-b border-border/50 last:border-0 py-1">
            <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
              <span className="text-[10px] bg-muted px-1 rounded">{stackIdx}</span>
              {displayIdx === 0 && <span className="text-[10px] text-primary">TOS</span>}
              <span className="text-[10px]">{getValueType(value)}</span>
            </div>
            <ValueInspector value={value} defaultExpanded={displayIdx < 3} />
          </div>
        )
      })}
    </div>
  )
}
