import { onMount, onCleanup, createSignal, createEffect } from 'solid-js'
import { createStructureEditor } from '../core/createStructureEditor'
import type { StructureEditor as StructureEditorType, JsonValue } from '../core/types'

export interface StructureEditorProps {
  /** Initial JSON content */
  content?: JsonValue
  /** Callback when content changes */
  onChange?: (json: JsonValue) => void
  /** Callback when editor is ready */
  onReady?: (editor: StructureEditorType) => void
  /** Whether editor is read-only */
  readonly?: boolean
  /** Placeholder text */
  placeholder?: string
  /** CSS class for the container */
  class?: string
}

/**
 * StructureEditor - Solid component wrapper for the Tiptap structure editor
 *
 * Usage:
 * ```tsx
 * <StructureEditor
 *   content={{ name: "test" }}
 *   onChange={(json) => console.log(json)}
 * />
 * ```
 */
export function StructureEditor(props: StructureEditorProps) {
  let containerRef: HTMLDivElement | undefined
  let editorInstance: StructureEditorType | undefined

  const [isReady, setIsReady] = createSignal(false)

  onMount(() => {
    if (!containerRef) return

    editorInstance = createStructureEditor(containerRef, {
      content: props.content,
      onChange: props.onChange,
      onReady: (editor) => {
        setIsReady(true)
        props.onReady?.({
          editor: editor.editor,
          getJson: () => editorInstance!.getJson(),
          setJson: (json) => editorInstance!.setJson(json),
          focus: () => editorInstance!.focus(),
          destroy: () => editorInstance!.destroy(),
        })
      },
      readonly: props.readonly,
      placeholder: props.placeholder,
    })
  })

  onCleanup(() => {
    editorInstance?.destroy()
  })

  // Update content when prop changes (controlled mode)
  createEffect(() => {
    const newContent = props.content
    if (editorInstance && isReady() && newContent !== undefined) {
      // Only update if content is different
      const currentJson = editorInstance.getJson()
      if (JSON.stringify(currentJson) !== JSON.stringify(newContent)) {
        editorInstance.setJson(newContent)
      }
    }
  })

  return (
    <div
      ref={containerRef}
      class={`structure-editor ${props.class || ''}`}
      data-placeholder={props.placeholder || 'Type / for commands...'}
    />
  )
}

export default StructureEditor
