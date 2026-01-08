/**
 * Semantic Documentation Seeder
 *
 * Reads markdown files from docs/semantics/ and seeds the database
 * with structured documentation that can be applied to new semantics.
 */

import Database from 'better-sqlite3'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface SemanticDoc {
  id: string
  name: string
  summary: string
  description: string
  usage: string
  examples: string
}

/**
 * Parse YAML-like frontmatter from markdown
 * Expects format:
 * ---
 * id: filter
 * name: Filter
 * summary: Brief description
 * ---
 */
function parseFrontmatter(content: string): { data: Record<string, string>; body: string } {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)

  if (!frontmatterMatch) {
    return { data: {}, body: content }
  }

  const [, frontmatterStr, body] = frontmatterMatch
  const data: Record<string, string> = {}

  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()
      data[key] = value
    }
  }

  return { data, body }
}

/**
 * Extract sections from markdown body
 * Looks for # Section headers and captures content until next header
 */
function extractSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {}

  // Split by top-level headers (# Header)
  const lines = markdown.split('\n')
  let currentSection = ''
  let currentContent: string[] = []

  for (const line of lines) {
    // Match # Header (top-level only)
    const headerMatch = line.match(/^#\s+(.+)$/)
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        sections[currentSection.toLowerCase()] = currentContent.join('\n').trim()
      }
      currentSection = headerMatch[1]
      currentContent = []
    } else if (currentSection) {
      currentContent.push(line)
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection.toLowerCase()] = currentContent.join('\n').trim()
  }

  return sections
}

/**
 * Parse a single semantic documentation markdown file
 */
export function parseSemanticDoc(filePath: string): SemanticDoc | null {
  const content = readFileSync(filePath, 'utf-8')
  const { data: frontmatter, body } = parseFrontmatter(content)

  if (!frontmatter.id) {
    console.warn(`[seedDocs] Skipping ${filePath}: missing 'id' in frontmatter`)
    return null
  }

  const sections = extractSections(body)

  return {
    id: frontmatter.id,
    name: frontmatter.name || frontmatter.id,
    summary: frontmatter.summary || '',
    description: sections.description || '',
    usage: sections.usage || '',
    examples: sections.examples || '',
  }
}

/**
 * Load all semantic docs from the docs/semantics directory
 */
export function loadSemanticDocs(docsDir: string): Map<string, SemanticDoc> {
  const docs = new Map<string, SemanticDoc>()

  if (!existsSync(docsDir)) {
    console.warn(`[seedDocs] Docs directory not found: ${docsDir}`)
    return docs
  }

  const files = readdirSync(docsDir).filter(f => f.endsWith('.md'))

  for (const file of files) {
    const doc = parseSemanticDoc(join(docsDir, file))
    if (doc) {
      docs.set(doc.id, doc)
    }
  }

  return docs
}

/**
 * Seed semantic docs into the database
 */
export function seedSemanticDocs(db: Database.Database, docsDir: string) {
  const docs = loadSemanticDocs(docsDir)

  if (docs.size === 0) {
    console.log('[seedDocs] No semantic docs found to seed')
    return
  }

  console.log('[seedDocs] Seeding semantic documentation...')

  const insertDoc = db.prepare(`
    INSERT OR REPLACE INTO semantic_docs (id, name, summary, description, usage, examples, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const now = Date.now()

  for (const [id, doc] of docs) {
    insertDoc.run(id, doc.name, doc.summary, doc.description, doc.usage, doc.examples, now)
    console.log(`[seedDocs]   ✓ ${doc.name}`)
  }

  // Update existing semantic entities that are missing help.* attrs
  console.log('[seedDocs] Updating existing semantics with missing docs...')

  // Find all semantic entities (have semantic.type attr) that lack help.summary
  const semanticEntities = db.prepare(`
    SELECT DISTINCT a.entity_id, a.value as semantic_type
    FROM attrs a
    WHERE a.key = 'semantic.type'
    AND NOT EXISTS (
      SELECT 1 FROM attrs h
      WHERE h.entity_id = a.entity_id
      AND h.key = 'help.summary'
    )
  `).all() as Array<{ entity_id: string; semantic_type: string }>

  const insertAttr = db.prepare(`
    INSERT OR REPLACE INTO attrs (entity_id, key, value, type)
    VALUES (?, ?, ?, 'string')
  `)

  let updated = 0
  for (const { entity_id, semantic_type } of semanticEntities) {
    const doc = docs.get(semantic_type)
    if (doc) {
      if (doc.summary) insertAttr.run(entity_id, 'help.summary', doc.summary)
      if (doc.description) insertAttr.run(entity_id, 'help.description', doc.description)
      if (doc.usage) insertAttr.run(entity_id, 'help.usage', doc.usage)
      if (doc.examples) insertAttr.run(entity_id, 'help.examples', doc.examples)
      updated++
      console.log(`[seedDocs]   ✓ Updated ${semantic_type} entity ${entity_id.slice(0, 8)}...`)
    }
  }

  console.log(`[seedDocs] Complete. Seeded ${docs.size} docs, updated ${updated} existing semantics.`)
}
