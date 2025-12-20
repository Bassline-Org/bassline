// Command registry for tcl commands
// Commands can come from:
// 1. ~/.blt/commands/*.tcl files (global commands)
// 2. Page snippets with type 'command'

import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join, basename } from 'path'

const COMMANDS_DIR = join(homedir(), '.blt', 'commands')

export interface Command {
  name: string
  source: 'file' | 'page'
  sourceId: string // filename or pageId:snippetId
  content: string
}

// Global command registry
const commands: Map<string, Command> = new Map()

function ensureDir() {
  if (!existsSync(COMMANDS_DIR)) {
    mkdirSync(COMMANDS_DIR, { recursive: true })
  }
}

// Parse proc name from tcl content
// Looks for: proc name {args} { ... }
export function parseProcName(content: string): string | null {
  const match = content.match(/^\s*proc\s+([a-zA-Z_][a-zA-Z0-9_-]*)\s*[\{\(]/)
  return match ? match[1] : null
}

// Load commands from ~/.blt/commands/*.tcl
export function loadFileCommands(): Command[] {
  ensureDir()
  const loaded: Command[] = []
  try {
    const files = readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.tcl'))
    for (const file of files) {
      try {
        const content = readFileSync(join(COMMANDS_DIR, file), 'utf8')
        const name = parseProcName(content) || basename(file, '.tcl')
        const command: Command = {
          name,
          source: 'file',
          sourceId: file,
          content,
        }
        commands.set(name, command)
        loaded.push(command)
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return loaded
}

// Save a command to file
export function saveCommandToFile(name: string, content: string): void {
  ensureDir()
  writeFileSync(join(COMMANDS_DIR, `${name}.tcl`), content)
  const command: Command = {
    name,
    source: 'file',
    sourceId: `${name}.tcl`,
    content,
  }
  commands.set(name, command)
}

// Delete a file command
export function deleteFileCommand(name: string): boolean {
  const cmd = commands.get(name)
  if (!cmd || cmd.source !== 'file') return false
  try {
    unlinkSync(join(COMMANDS_DIR, cmd.sourceId))
    commands.delete(name)
    return true
  } catch {
    return false
  }
}

// Register a command from a page snippet
export function registerPageCommand(pageId: string, snippetId: string, content: string): Command | null {
  const name = parseProcName(content)
  if (!name) return null

  const command: Command = {
    name,
    source: 'page',
    sourceId: `${pageId}:${snippetId}`,
    content,
  }
  commands.set(name, command)
  return command
}

export function unregisterCommand(name: string): boolean {
  return commands.delete(name)
}

export function unregisterPageCommands(pageId: string): void {
  for (const [name, cmd] of commands) {
    if (cmd.source === 'page' && cmd.sourceId.startsWith(`${pageId}:`)) {
      commands.delete(name)
    }
  }
}

export function getCommand(name: string): Command | undefined {
  return commands.get(name)
}

export function getAllCommands(): Command[] {
  return Array.from(commands.values())
}

export function getFileCommands(): Command[] {
  return Array.from(commands.values()).filter(c => c.source === 'file')
}

export function getPageCommands(): Command[] {
  return Array.from(commands.values()).filter(c => c.source === 'page')
}

export function clearCommands(): void {
  commands.clear()
}

// Scan page snippets and register all command-type snippets
export function registerPageCommands(
  pageId: string,
  snippets: Array<{ id: string; type: string; content: string }>
): void {
  // First, unregister existing commands from this page
  unregisterPageCommands(pageId)

  // Register command snippets
  for (const snippet of snippets) {
    if (snippet.type === 'command') {
      registerPageCommand(pageId, snippet.id, snippet.content)
    }
  }
}

// Initialize: load file commands on startup
export function initCommands(): void {
  loadFileCommands()
}
