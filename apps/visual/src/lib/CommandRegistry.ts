/**
 * CommandRegistry - Syncs Borth commands to SQLite database
 *
 * Listens to runtime events and persists command metadata for querying.
 */

// Types for commands and hooks
export interface Command {
  name: string
  doc?: string
  key?: string
  menu?: string
  icon?: string
  when_condition?: string
  category?: string
  source_file?: string
  enabled?: boolean
}

export interface Hook {
  event: string
  command: string
  priority?: number
  run_async?: boolean
  debounce_ms?: number
  throttle_ms?: number
}

export interface Setting {
  name: string
  type: string
  default_value: unknown
  current_value: unknown
  constraints?: {
    min?: number
    max?: number
    step?: number
    choices?: string[]
    maxlength?: number
    pattern?: string
  }
  category?: string
  doc?: string
}

// Word with attributes from Borth runtime
interface WordWithAttrs {
  name: string
  attributes: Record<string, unknown>
}

/**
 * Register a command to the database
 */
export async function registerCommand(word: WordWithAttrs): Promise<void> {
  if (!window.db) return

  const { attributes } = word
  const name = word.name
  if (!name) return

  const sql = `
    INSERT OR REPLACE INTO commands
    (name, doc, key, menu, icon, when_condition, category, registered_at, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `
  const params = [
    name,
    attributes.doc ?? null,
    attributes.key ?? null,
    attributes.menu ?? null,
    attributes.icon ?? null,
    attributes.when ?? null,
    attributes.category ?? null,
    new Date().toISOString(),
  ]

  const result = await window.db.query(sql, params)
  if (result.error) {
    console.error('Failed to register command:', result.error)
  }
}

/**
 * Register a hook to the database
 */
export async function registerHook(word: WordWithAttrs): Promise<void> {
  if (!window.db) return

  const { attributes } = word
  const command = word.name
  const event = attributes.hook as string
  if (!command || !event) return

  // Delete existing hook for this command+event combo first
  await window.db.query(
    'DELETE FROM hooks WHERE event = ? AND command = ?',
    [event, command]
  )

  const sql = `
    INSERT INTO hooks
    (event, command, priority, run_async, enabled, registered_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `
  const params = [
    event,
    command,
    attributes.priority ?? 50,
    attributes.async ? 1 : 0,
    new Date().toISOString(),
  ]

  const result = await window.db.query(sql, params)
  if (result.error) {
    console.error('Failed to register hook:', result.error)
  }
}

/**
 * Register a setting to the database
 */
export async function registerSetting(word: WordWithAttrs): Promise<void> {
  if (!window.db) return

  const { attributes } = word
  const name = word.name
  if (!name) return

  // Build constraints object
  const constraints: Record<string, unknown> = {}
  if (attributes.min !== undefined) constraints.min = attributes.min
  if (attributes.max !== undefined) constraints.max = attributes.max
  if (attributes.step !== undefined) constraints.step = attributes.step
  if (attributes.choices !== undefined) constraints.choices = attributes.choices

  const sql = `
    INSERT OR REPLACE INTO blemacs_settings
    (name, type, default_value, current_value, constraints, category, doc)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  const params = [
    name,
    attributes.settingType ?? 'string',
    JSON.stringify(attributes.default ?? null),
    JSON.stringify(attributes.current ?? null),
    Object.keys(constraints).length > 0 ? JSON.stringify(constraints) : null,
    attributes.category ?? null,
    attributes.doc ?? null,
  ]

  const result = await window.db.query(sql, params)
  if (result.error) {
    console.error('Failed to register setting:', result.error)
  }
}

/**
 * Get all enabled commands
 */
export async function getCommands(): Promise<Command[]> {
  if (!window.db) return []

  const result = await window.db.query(
    'SELECT * FROM commands WHERE enabled = 1 ORDER BY name'
  )
  return (result.data as Command[]) ?? []
}

/**
 * Get command by keybinding
 */
export async function getCommandByKey(key: string): Promise<Command | null> {
  if (!window.db) return null

  const result = await window.db.query(
    'SELECT * FROM commands WHERE key = ? AND enabled = 1 LIMIT 1',
    [key]
  )
  return (result.data as Command[])?.[0] ?? null
}

/**
 * Check if any commands start with the given key prefix (for chord detection)
 */
export async function hasChordStartingWith(prefix: string): Promise<boolean> {
  if (!window.db) return false

  const result = await window.db.query(
    "SELECT 1 FROM commands WHERE key LIKE ? AND enabled = 1 LIMIT 1",
    [`${prefix} %`]
  )
  return (result.data?.length ?? 0) > 0
}

/**
 * Get hooks for an event
 */
export async function getHooksForEvent(event: string): Promise<Hook[]> {
  if (!window.db) return []

  const result = await window.db.query(
    'SELECT * FROM hooks WHERE event = ? AND enabled = 1 ORDER BY priority ASC',
    [event]
  )
  return (result.data as Hook[]) ?? []
}

/**
 * Get all settings
 */
export async function getSettings(): Promise<Setting[]> {
  if (!window.db) return []

  const result = await window.db.query(
    'SELECT * FROM blemacs_settings ORDER BY category, display_order, name'
  )
  return ((result.data ?? []) as Array<Record<string, unknown>>).map(row => ({
    name: row.name as string,
    type: row.type as string,
    default_value: row.default_value ? JSON.parse(row.default_value as string) : null,
    current_value: row.current_value ? JSON.parse(row.current_value as string) : null,
    constraints: row.constraints ? JSON.parse(row.constraints as string) : undefined,
    category: row.category as string | undefined,
    doc: row.doc as string | undefined,
  }))
}

/**
 * Update a setting value
 */
export async function updateSetting(name: string, value: unknown): Promise<void> {
  if (!window.db) return

  await window.db.query(
    'UPDATE blemacs_settings SET current_value = ? WHERE name = ?',
    [JSON.stringify(value), name]
  )
}
