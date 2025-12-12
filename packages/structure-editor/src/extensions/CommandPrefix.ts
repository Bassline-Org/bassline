import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { StructureCommand } from '../core/types'

export interface CommandPrefixOptions {
  /** Character that triggers command mode */
  prefix: string
  /** Callback when command palette should show */
  onShowPalette?: (query: string, commands: StructureCommand[]) => void
  /** Callback when command palette should hide */
  onHidePalette?: () => void
  /** Additional custom commands */
  customCommands?: StructureCommand[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commandPrefix: {
      showCommandPalette: (query?: string) => ReturnType
      hideCommandPalette: () => ReturnType
      executeCommand: (name: string) => ReturnType
    }
  }
}

/**
 * CommandPrefix - Handles /command dispatch
 *
 * Type / to trigger command palette.
 * Commands: /object, /array, /string, /number, /true, /false, /null
 */
export const CommandPrefix = Extension.create<CommandPrefixOptions>({
  name: 'commandPrefix',

  // Higher priority (lower number) so Enter handler runs before other extensions
  priority: 1000,

  addOptions() {
    return {
      prefix: '/',
      onShowPalette: undefined,
      onHidePalette: undefined,
      customCommands: [],
    }
  },

  addStorage() {
    return {
      isActive: false,
      query: '',
      commands: [] as StructureCommand[],
    }
  },

  onCreate() {
    // Register built-in commands
    this.storage.commands = [
      {
        name: 'object',
        description: 'Create a JSON object { }',
        execute: (editor) => editor.commands.insertObject(),
      },
      {
        name: 'array',
        description: 'Create a JSON array [ ]',
        execute: (editor) => editor.commands.insertArray(),
      },
      {
        name: 'string',
        description: 'Create a string value',
        execute: (editor) => editor.commands.insertPrimitive(''),
      },
      {
        name: 'number',
        description: 'Create a number value',
        execute: (editor) => editor.commands.insertPrimitive(0),
      },
      {
        name: 'true',
        description: 'Insert boolean true',
        execute: (editor) => editor.commands.insertPrimitive(true),
      },
      {
        name: 'false',
        description: 'Insert boolean false',
        execute: (editor) => editor.commands.insertPrimitive(false),
      },
      {
        name: 'null',
        description: 'Insert null value',
        execute: (editor) => editor.commands.insertPrimitive(null),
      },
      ...(this.options.customCommands || []),
    ]
  },

  addCommands() {
    return {
      showCommandPalette:
        (query = '') =>
        ({ editor }) => {
          this.storage.isActive = true
          this.storage.query = query

          // Filter commands by query
          const filtered = this.storage.commands.filter((cmd) =>
            cmd.name.toLowerCase().startsWith(query.toLowerCase())
          )

          this.options.onShowPalette?.(query, filtered)
          return true
        },

      hideCommandPalette:
        () =>
        ({ editor }) => {
          this.storage.isActive = false
          this.storage.query = ''
          this.options.onHidePalette?.()
          return true
        },

      executeCommand:
        (name: string) =>
        ({ editor }) => {
          const command = this.storage.commands.find(
            (cmd) => cmd.name.toLowerCase() === name.toLowerCase()
          )

          if (command) {
            command.execute(editor)
            this.storage.isActive = false
            this.storage.query = ''
            this.options.onHidePalette?.()
            return true
          }

          return false
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Escape hides palette
      Escape: ({ editor }) => {
        if (this.storage.isActive) {
          return editor.commands.hideCommandPalette()
        }
        return false
      },

      // Enter executes first matching command
      Enter: ({ editor }) => {
        console.log('CommandPrefix Enter:', {
          isActive: this.storage.isActive,
          query: this.storage.query,
        })

        if (!this.storage.isActive) {
          console.log('CommandPrefix: not active, returning false')
          return false
        }

        const query = this.storage.query
        if (!query) {
          console.log('CommandPrefix: no query, returning false')
          return false
        }

        const command = this.storage.commands.find((cmd) =>
          cmd.name.toLowerCase().startsWith(query.toLowerCase())
        )

        console.log('Found command:', command?.name)

        if (!command) {
          console.log('CommandPrefix: no matching command, returning false')
          return false
        }

        // Delete the /query text first, then execute command
        const { from } = editor.state.selection
        const prefixLen = this.options.prefix.length + query.length

        console.log(
          'Executing command:',
          command.name,
          'deleting from',
          from - prefixLen,
          'to',
          from
        )

        // Reset state BEFORE executing to prevent re-entry
        this.storage.isActive = false
        this.storage.query = ''
        this.options.onHidePalette?.()

        // Use chain for atomic operation
        editor
          .chain()
          .deleteRange({ from: from - prefixLen, to: from })
          .run()

        // Execute the command
        command.execute(editor)

        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const prefix = this.options.prefix

    return [
      new Plugin({
        key: new PluginKey('commandPrefix'),

        props: {
          handleTextInput: (view, from, to, text) => {
            const { state } = view

            // Check if we just typed the prefix
            if (text === prefix) {
              // Show palette with empty query
              setTimeout(() => {
                this.editor.commands.showCommandPalette('')
              }, 0)
              return false
            }

            // If palette is active, update query
            if (this.storage.isActive) {
              // Get the text after the prefix
              const $from = state.selection.$from
              const textBefore = $from.parent.textBetween(
                Math.max(0, $from.parentOffset - 20),
                $from.parentOffset,
                ''
              )

              // Find the prefix position
              const prefixPos = textBefore.lastIndexOf(prefix)
              if (prefixPos >= 0) {
                const query = textBefore.slice(prefixPos + prefix.length) + text
                this.editor.commands.showCommandPalette(query)
              }
            }

            return false
          },

          handleKeyDown: (view, event) => {
            // Space or non-alphanumeric (except allowed chars) cancels command mode
            if (this.storage.isActive) {
              if (event.key === ' ') {
                this.editor.commands.hideCommandPalette()
              }
            }
            return false
          },
        },
      }),
    ]
  },
})
