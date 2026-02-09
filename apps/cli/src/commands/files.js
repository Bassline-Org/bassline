import { readFile, readdir } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'public'])
const EXCLUDED_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'])
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.json', '.tcl', '.md', '.txt',
  '.html', '.css', '.toml', '.yaml', '.yml',
])

export async function collectProjectFiles(rootDir) {
  const files = []

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) await walk(full)
      } else {
        if (EXCLUDED_FILES.has(entry.name)) continue
        if (entry.name.endsWith('.bundle.json')) continue
        const ext = extname(entry.name)
        if (ext && !TEXT_EXTENSIONS.has(ext)) continue
        const rel = relative(rootDir, full)
        const content = await readFile(full, 'utf-8')
        files.push({ path: rel, content })
      }
    }
  }

  await walk(rootDir)
  return files
}
