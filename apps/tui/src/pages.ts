import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

const PAGES_DIR = join(homedir(), '.blt', 'pages')

function ensureDir() {
  if (!existsSync(PAGES_DIR)) {
    mkdirSync(PAGES_DIR, { recursive: true })
  }
}

export function loadPageList() {
  ensureDir()
  try {
    const files = readdirSync(PAGES_DIR).filter(f => f.endsWith('.json'))
    return files
      .map(f => {
        try {
          const page = JSON.parse(readFileSync(join(PAGES_DIR, f), 'utf8'))
          return { id: page.id, title: page.title, modified: page.modified }
        } catch {
          return null
        }
      })
      .filter((x): x is { id: string; title: string; modified: string } => x !== null)
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  } catch {
    return []
  }
}

export function loadPage(id) {
  ensureDir()
  try {
    return JSON.parse(readFileSync(join(PAGES_DIR, `${id}.json`), 'utf8'))
  } catch {
    return null
  }
}

export function savePage(page) {
  ensureDir()
  page.modified = new Date().toISOString()
  writeFileSync(join(PAGES_DIR, `${page.id}.json`), JSON.stringify(page, null, 2))
  return page
}

export function createPage(title) {
  const now = new Date().toISOString()
  const page = {
    id: randomUUID(),
    title,
    created: now,
    modified: now,
    snippets: [{ id: randomUUID(), type: 'tcl', content: '' }],
  }
  return savePage(page)
}

export function deletePage(id) {
  ensureDir()
  try {
    unlinkSync(join(PAGES_DIR, `${id}.json`))
    return true
  } catch {
    return false
  }
}

export function createSnippet(type = 'tcl', content = '') {
  return { id: randomUUID(), type, content }
}
