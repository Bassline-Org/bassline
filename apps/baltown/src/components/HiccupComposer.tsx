import { createSignal, Show, For, createMemo } from 'solid-js'
import HandlerPicker, { HANDLER_CATEGORIES } from './HandlerPicker'
import { ConfigDispatcher } from './handlers'
import { getHandlerMetadata, handlerRequiresConfig } from '../lib/handlerMetadata'

type HiccupNode = string | [string, ...any[]]

interface HiccupComposerProps {
  value: HiccupNode
  onChange: (value: HiccupNode) => void
}

/**
 * Visual composer for building hiccup-style handler compositions
 *
 * Hiccup format: handler | [handler, config?, ...args]
 * Examples:
 *   'sum'
 *   ['multiply', { value: 2 }]
 *   ['pipe', 'sum', ['multiply', { value: 2 }]]
 */
export default function HiccupComposer(props: HiccupComposerProps) {
  return (
    <div class="hiccup-composer">
      <div class="composer-tree">
        <HiccupNode node={props.value} onChange={props.onChange} depth={0} path={[]} />
      </div>

      <div class="composer-preview">
        <label>JSON Preview:</label>
        <pre>{JSON.stringify(props.value, null, 2)}</pre>
      </div>

      <style>{`
        .hiccup-composer {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .composer-tree {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 16px;
          min-height: 100px;
        }

        .composer-preview {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          padding: 12px;
        }

        .composer-preview label {
          display: block;
          font-size: 11px;
          color: #8b949e;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .composer-preview pre {
          margin: 0;
          font-size: 12px;
          color: #79c0ff;
        }
      `}</style>
    </div>
  )
}

interface HiccupNodeProps {
  node: HiccupNode
  onChange: (node: HiccupNode) => void
  depth: number
  path: number[]
}

function HiccupNode(props: HiccupNodeProps) {
  const [editing, setEditing] = createSignal(false)
  const [configEditing, setConfigEditing] = createSignal(false)
  const [configText, setConfigText] = createSignal('')

  // Parse node structure
  const isArray = () => Array.isArray(props.node)
  const handlerName = () => (isArray() ? (props.node as any[])[0] : props.node)
  const hasConfig = () =>
    isArray() &&
    (props.node as any[]).length > 1 &&
    typeof (props.node as any[])[1] === 'object' &&
    !Array.isArray((props.node as any[])[1])
  const config = () => (hasConfig() ? (props.node as any[])[1] : null)
  const children = () => {
    if (!isArray()) return []
    const arr = props.node as any[]
    const startIdx = hasConfig() ? 2 : 1
    return arr.slice(startIdx)
  }

  // Check if this handler is a combinator (can have children)
  const isCombinator = () => {
    const name = handlerName()
    return [
      'pipe',
      'sequence',
      'compose',
      'fork',
      'converge',
      'both',
      'hook',
      'tryCatch',
      'map',
      'filter',
      'when',
      'ifElse',
      'cond',
    ].includes(name)
  }

  // Get handler info from categories
  const handlerInfo = createMemo(() => {
    const name = handlerName()
    for (const category of Object.values(HANDLER_CATEGORIES)) {
      if (name in category.handlers) {
        return category.handlers[name as keyof typeof category.handlers]
      }
    }
    return null
  })

  // Update handler name
  function updateHandler(newName: string) {
    if (!isArray()) {
      props.onChange(newName)
    } else {
      const arr = [...(props.node as any[])]
      arr[0] = newName
      props.onChange(arr as HiccupNode)
    }
    setEditing(false)
  }

  // Update config
  function updateConfig() {
    try {
      const newConfig = JSON.parse(configText())
      if (!isArray()) {
        props.onChange([handlerName(), newConfig])
      } else {
        const arr = [...(props.node as any[])]
        if (hasConfig()) {
          arr[1] = newConfig
        } else {
          arr.splice(1, 0, newConfig)
        }
        props.onChange(arr as HiccupNode)
      }
      setConfigEditing(false)
    } catch (e) {
      // Invalid JSON
    }
  }

  // Remove config
  function removeConfig() {
    if (isArray() && hasConfig()) {
      const arr = [...(props.node as any[])]
      arr.splice(1, 1)
      if (arr.length === 1) {
        props.onChange(arr[0])
      } else {
        props.onChange(arr as HiccupNode)
      }
    }
  }

  // Add child handler
  function addChild() {
    const arr = isArray() ? [...(props.node as any[])] : [props.node]
    arr.push('identity')
    props.onChange(arr as HiccupNode)
  }

  // Update child at index
  function updateChild(index: number, newChild: HiccupNode) {
    if (!isArray()) return
    const arr = [...(props.node as any[])]
    const startIdx = hasConfig() ? 2 : 1
    arr[startIdx + index] = newChild
    props.onChange(arr as HiccupNode)
  }

  // Remove child at index
  function removeChild(index: number) {
    if (!isArray()) return
    const arr = [...(props.node as any[])]
    const startIdx = hasConfig() ? 2 : 1
    arr.splice(startIdx + index, 1)
    if (arr.length === 1) {
      props.onChange(arr[0])
    } else if (arr.length === 2 && !hasConfig()) {
      props.onChange(arr as HiccupNode)
    } else {
      props.onChange(arr as HiccupNode)
    }
  }

  // Convert simple handler to array (to add children or config)
  function convertToArray() {
    if (!isArray()) {
      props.onChange([props.node as string])
    }
  }

  return (
    <div class="hiccup-node" style={{ 'margin-left': `${props.depth * 20}px` }}>
      <div class="node-header">
        <Show
          when={!editing()}
          fallback={
            <div class="node-picker">
              <HandlerPicker value={handlerName()} onChange={updateHandler} />
            </div>
          }
        >
          <span class="node-name" onClick={() => setEditing(true)}>
            {handlerName()}
          </span>
        </Show>

        <Show when={handlerRequiresConfig(handlerName())}>
          <Show
            when={!configEditing()}
            fallback={
              <div class="config-editor-expanded" onClick={(e) => e.stopPropagation()}>
                <ConfigDispatcher
                  handler={handlerName()}
                  config={config() ?? {}}
                  onChange={(newConfig) => {
                    if (!isArray()) {
                      props.onChange([handlerName(), newConfig])
                    } else {
                      const arr = [...(props.node as any[])]
                      if (hasConfig()) {
                        arr[1] = newConfig
                      } else {
                        arr.splice(1, 0, newConfig)
                      }
                      props.onChange(arr as HiccupNode)
                    }
                  }}
                />
                <button class="btn-sm done-btn" onClick={() => setConfigEditing(false)}>
                  Done
                </button>
              </div>
            }
          >
            <Show when={hasConfig()}>
              <span class="node-config" onClick={() => setConfigEditing(true)}>
                {JSON.stringify(config())}
              </span>
              <button class="btn-icon" onClick={removeConfig} title="Remove config">
                ×
              </button>
            </Show>
            <Show when={!hasConfig()}>
              <button class="btn-sm secondary" onClick={() => setConfigEditing(true)}>
                + Config
              </button>
            </Show>
          </Show>
        </Show>

        <Show when={isCombinator()}>
          <button class="btn-sm secondary" onClick={addChild}>
            + Add
          </button>
        </Show>

        <Show when={props.depth > 0}>
          <button
            class="btn-icon delete"
            onClick={() => {
              /* handled by parent */
            }}
            title="Remove"
          >
            ×
          </button>
        </Show>
      </div>

      <Show when={children().length > 0}>
        <div class="node-children">
          <For each={children()}>
            {(child, i) => (
              <div class="child-wrapper">
                <HiccupNode
                  node={child}
                  onChange={(newChild) => updateChild(i(), newChild)}
                  depth={props.depth + 1}
                  path={[...props.path, i()]}
                />
                <button
                  class="btn-icon delete child-delete"
                  onClick={() => removeChild(i())}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <style>{`
        .hiccup-node {
          position: relative;
        }

        .node-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          background: #21262d;
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .node-name {
          font-family: monospace;
          font-size: 13px;
          color: #79c0ff;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .node-name:hover {
          background: #30363d;
        }

        .node-picker {
          flex: 1;
          min-width: 250px;
        }

        .node-config {
          font-family: monospace;
          font-size: 11px;
          color: #8b949e;
          background: #0d1117;
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .node-config:hover {
          background: #161b22;
          color: #c9d1d9;
        }

        .config-editor-expanded {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 100;
          margin-top: 4px;
          max-width: 500px;
        }

        .config-editor-expanded .done-btn {
          margin-top: 8px;
          width: 100%;
        }

        .btn-sm {
          font-size: 11px;
          padding: 2px 8px;
          background: #238636;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        }

        .btn-sm.secondary {
          background: #30363d;
          color: #c9d1d9;
        }

        .btn-sm:hover {
          filter: brightness(1.1);
        }

        .btn-icon {
          width: 20px;
          height: 20px;
          padding: 0;
          background: transparent;
          border: none;
          color: #8b949e;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          border-radius: 3px;
        }

        .btn-icon:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .btn-icon.delete:hover {
          background: #f8514933;
          color: #f85149;
        }

        .node-children {
          border-left: 2px solid #30363d;
          margin-left: 12px;
          padding-left: 8px;
        }

        .child-wrapper {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 4px;
        }

        .child-wrapper > .hiccup-node {
          flex: 1;
        }

        .child-delete {
          margin-top: 6px;
        }
      `}</style>
    </div>
  )
}

// Helper to create an empty composition
export function createEmptyComposition(): HiccupNode {
  return 'identity'
}

// Helper to parse a JSON string into a hiccup node
function parseHiccup(json: string): HiccupNode | null {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed === 'string') return parsed
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed
    return null
  } catch {
    return null
  }
}
