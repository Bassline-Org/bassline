import { onMount, onCleanup, createSignal } from 'solid-js'
import {
  createStructureEditor,
  type StructureEditor,
  type StructureCommand,
} from '@bassline/structure-editor'
import { CommandPalette } from '@bassline/structure-editor/components'
import '@bassline/structure-editor/styles.css'

/**
 * Simple test page for the structure editor
 * No canvas, no dragging - just the editor
 */
export default function EditorTest() {
  let editorRef: HTMLDivElement | undefined
  let editorInstance: StructureEditor | undefined

  const [paletteVisible, setPaletteVisible] = createSignal(false)
  const [paletteQuery, setPaletteQuery] = createSignal('')
  const [paletteCommands, setPaletteCommands] = createSignal<StructureCommand[]>([])

  onMount(() => {
    if (!editorRef) {
      console.error('editorRef is undefined')
      return
    }

    console.log('Creating editor on element:', editorRef)

    editorInstance = createStructureEditor(editorRef, {
      content: null,
      onChange: (json) => {
        console.log('Content changed:', json)
      },
      placeholder: 'Type / for commands...',
      onShowPalette: (query, commands) => {
        console.log(
          'Show palette:',
          query,
          commands.map((c) => c.name)
        )
        setPaletteQuery(query)
        setPaletteCommands(commands)
        setPaletteVisible(true)
      },
      onHidePalette: () => {
        console.log('Hide palette')
        setPaletteVisible(false)
      },
    })

    console.log('Editor created:', editorInstance)
    console.log('Editor element:', editorInstance.editor.view.dom)
  })

  onCleanup(() => {
    editorInstance?.destroy()
  })

  const handleCommandSelect = (command: StructureCommand) => {
    if (editorInstance) {
      // Execute the command
      command.execute(editorInstance.editor)
      setPaletteVisible(false)
    }
  }

  const handlePaletteClose = () => {
    setPaletteVisible(false)
    if (editorInstance) {
      editorInstance.editor.commands.hideCommandPalette()
    }
  }

  return (
    <div class="editor-test-page">
      <h1>Structure Editor Test</h1>
      <p>
        Type <kbd>/</kbd> to see the command palette. Try <kbd>/object</kbd> or <kbd>/array</kbd>
      </p>

      <div class="editor-wrapper" style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          class="structure-editor"
          style={{
            'min-height': '200px',
            'max-width': '600px',
          }}
        />
        <CommandPalette
          isVisible={paletteVisible()}
          query={paletteQuery()}
          commands={paletteCommands()}
          onSelect={handleCommandSelect}
          onClose={handlePaletteClose}
        />
      </div>

      <style>{`
        .editor-test-page {
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }

        .editor-test-page h1 {
          color: #c9d1d9;
          margin-bottom: 8px;
        }

        .editor-test-page p {
          color: #8b949e;
          margin-bottom: 20px;
        }

        .editor-test-page kbd {
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 3px;
          padding: 2px 6px;
          font-family: inherit;
          font-size: 12px;
        }

        .editor-wrapper {
          margin: 20px 0;
        }
      `}</style>
    </div>
  )
}
