import Database from 'better-sqlite3'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { seedSemanticDocs } from './seedDocs'

interface TokenDefinition {
  id: string
  category: string
  label: string
  description: string
}

interface TokensFile {
  version: string
  categories: Array<{ id: string; label: string }>
  tokens: TokenDefinition[]
}

interface ThemeFile {
  id: string
  name: string
  description: string
  author?: string
  colors: Record<string, string>
  typography?: Record<string, string>
}

// Helper to check if a column exists in a table
function columnExists(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return cols.some(c => c.name === column)
}

export function runMigrations(db: Database.Database, dataDir: string) {
  const schemaDir = join(dataDir, 'schema')

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Get already-applied migrations
  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map(r => r.name)
  )

  // Backfill: if 005 columns exist but migration not tracked, mark as applied
  if (!applied.has('005_port_columns.sql') && columnExists(db, 'relationships', 'from_port')) {
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run('005_port_columns.sql')
    applied.add('005_port_columns.sql')
  }

  // Run schema migrations in order
  console.log('[migrations] Running migrations...')
  if (existsSync(schemaDir)) {
    const schemaFiles = readdirSync(schemaDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of schemaFiles) {
      if (applied.has(file)) {
        console.log(`[migrations]   - ${file} (already applied)`)
        continue
      }

      const sql = readFileSync(join(schemaDir, file), 'utf-8')
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
      console.log(`[migrations]   ✓ ${file}`)
    }
  }
  console.log('[migrations] Complete.')
}

export function seed(db: Database.Database, dataDir: string) {
  const themesDir = join(dataDir, 'themes')
  const tokensFile = join(dataDir, 'tokens.json')

  // 2. Load token definitions
  console.log('[seed] Loading token definitions...')
  if (existsSync(tokensFile)) {
    const tokenData: TokensFile = JSON.parse(readFileSync(tokensFile, 'utf-8'))
    const tokens = tokenData.tokens
    const tokenIds = new Set(tokens.map(t => t.id))

    const insertToken = db.prepare(`
      INSERT OR REPLACE INTO token_definitions (id, category, label, description)
      VALUES (?, ?, ?, ?)
    `)

    for (const token of tokens) {
      insertToken.run(token.id, token.category, token.label, token.description)
    }
    console.log(`[seed]   ✓ ${tokens.length} tokens defined`)

    // 3. Load and validate theme files
    console.log('[seed] Loading themes...')
    if (existsSync(themesDir)) {
      const themeFiles = readdirSync(themesDir).filter(f => f.endsWith('.json'))

      const insertTheme = db.prepare(`
        INSERT OR REPLACE INTO themes (id, name, description, author, is_system)
        VALUES (?, ?, ?, ?, 1)
      `)
      const insertColor = db.prepare(`
        INSERT OR REPLACE INTO theme_colors (theme_id, token_id, value)
        VALUES (?, ?, ?)
      `)

      for (const file of themeFiles) {
        const theme: ThemeFile = JSON.parse(readFileSync(join(themesDir, file), 'utf-8'))

        // Validate: theme must provide all color tokens
        const colorTokenIds = [...tokenIds].filter(id => !id.startsWith('font-'))
        const missing = colorTokenIds.filter(id => !(id in theme.colors))
        if (missing.length > 0) {
          console.warn(`[seed]   ⚠ ${file}: missing tokens: ${missing.join(', ')}`)
        }

        // Insert theme
        insertTheme.run(theme.id, theme.name, theme.description || '', theme.author || 'system')

        // Insert colors
        for (const [tokenId, value] of Object.entries(theme.colors)) {
          if (tokenIds.has(tokenId)) {
            insertColor.run(theme.id, tokenId, value)
          } else {
            console.warn(`[seed]   ⚠ ${file}: unknown token: ${tokenId}`)
          }
        }

        // Insert typography (stored in same table as colors)
        if (theme.typography) {
          for (const [tokenId, value] of Object.entries(theme.typography)) {
            if (tokenIds.has(tokenId)) {
              insertColor.run(theme.id, tokenId, value)
            } else {
              console.warn(`[seed]   ⚠ ${file}: unknown typography token: ${tokenId}`)
            }
          }
        }

        const typoCount = theme.typography ? Object.keys(theme.typography).length : 0
        console.log(`[seed]   ✓ ${theme.name} (${Object.keys(theme.colors).length} colors, ${typoCount} typography)`)
      }
    }
  }

  // 4. Set default settings
  console.log('[seed] Setting defaults...')
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
    .run('active_theme', 'dark')

  // 5. Seed semantic documentation
  const semanticDocsDir = join(dataDir, '../docs/semantics')
  if (existsSync(semanticDocsDir)) {
    seedSemanticDocs(db, semanticDocsDir)
  }

  console.log('[seed] Complete.')
}

export function needsSeed(db: Database.Database): boolean {
  // Check if themes table has data (seeding is separate from migrations now)
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM themes`).get() as { count: number }
    return result.count === 0
  } catch {
    // Table doesn't exist yet
    return true
  }
}
