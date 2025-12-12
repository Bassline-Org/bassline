import { createSignal, onMount, onCleanup, Show } from 'solid-js'
import {
  createStructureEditor,
  type StructureEditor,
  type JsonValue,
} from '@bassline/structure-editor'
import '@bassline/structure-editor/styles.css'

interface DataBlockProps {
  id: string
  content: JsonValue
  position: { x: number; y: number }
  onContentChange?: (id: string, content: JsonValue) => void
  onDragStart?: (id: string, e: MouseEvent) => void
  onDragEnd?: (id: string) => void
  selected?: boolean
  dragging?: boolean
}

/**
 * DataBlock - A draggable JSON editor block on the canvas
 *
 * Contains a structure editor for editing JSON content.
 * Can be dragged to resource nodes to PUT data.
 */
function DataBlock(props: DataBlockProps) {
  let containerRef: HTMLDivElement | undefined
  let editorRef: HTMLDivElement | undefined
  let editorInstance: StructureEditor | undefined

  const [isDragging, setIsDragging] = createSignal(false)
  const [isEditing, setIsEditing] = createSignal(false)

  onMount(() => {
    if (!editorRef) return

    editorInstance = createStructureEditor(editorRef, {
      content: props.content,
      onChange: (json) => {
        props.onContentChange?.(props.id, json)
      },
      placeholder: 'Type / for commands...',
    })
  })

  onCleanup(() => {
    editorInstance?.destroy()
  })

  function handleMouseDown(e: MouseEvent) {
    // Don't drag if clicking inside the editor
    if (editorRef?.contains(e.target as Node)) {
      setIsEditing(true)
      e.stopPropagation()
      // DON'T call preventDefault - let the browser handle focus naturally
      return
    }

    setIsDragging(true)
    props.onDragStart?.(props.id, e)
  }

  // Handle click on editor area to ensure focus
  function handleEditorClick(e: MouseEvent) {
    e.stopPropagation()
    // DON'T call preventDefault - let the browser handle focus naturally
    setIsEditing(true)
  }

  function handleMouseUp() {
    if (isDragging()) {
      setIsDragging(false)
      props.onDragEnd?.(props.id)
    }
  }

  return (
    <div
      ref={containerRef}
      class="data-block"
      classList={{
        'data-block--selected': props.selected,
        'data-block--dragging': props.dragging || isDragging(),
      }}
      style={{
        transform: `translate(${props.position.x}px, ${props.position.y}px)`,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div class="data-block__header">
        <span class="data-block__handle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="5" r="2" />
            <circle cx="12" cy="5" r="2" />
            <circle cx="19" cy="5" r="2" />
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="12" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
          </svg>
        </span>
        <span class="data-block__label">Data</span>
      </div>

      <div
        ref={editorRef}
        class="data-block__editor structure-editor"
        tabindex={0}
        onClick={handleEditorClick}
        onMouseDown={(e) => {
          e.stopPropagation()
          // Allow the click to reach ProseMirror for focus
        }}
      />

      <style>{`
        .data-block {
          position: absolute;
          min-width: 250px;
          max-width: 400px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          cursor: move;
          user-select: none;
        }

        .data-block--selected {
          border-color: #58a6ff;
          box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .data-block--dragging {
          opacity: 0.8;
          cursor: grabbing;
          z-index: 1000;
        }

        .data-block__header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #21262d;
          border-bottom: 1px solid #30363d;
          border-radius: 8px 8px 0 0;
        }

        .data-block__handle {
          color: #6e7681;
          cursor: grab;
        }

        .data-block--dragging .data-block__handle {
          cursor: grabbing;
        }

        .data-block__label {
          font-size: 12px;
          font-weight: 500;
          color: #8b949e;
        }

        .data-block__editor {
          padding: 0;
          cursor: text;
          user-select: text;
          /* Override parent's structure-editor styles for nested use */
          border: none !important;
          border-radius: 0 0 8px 8px !important;
          min-height: 60px;
        }

        .data-block__editor .ProseMirror {
          user-select: text !important;
          cursor: text !important;
          outline: none;
          min-height: 60px;
          padding: 12px;
        }

        .data-block__editor .ProseMirror:focus {
          outline: none;
        }

        .data-block__editor .ProseMirror p {
          margin: 0;
        }
      `}</style>
    </div>
  )
}

export default DataBlock
