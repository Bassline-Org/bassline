import { readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { confirm } from '@inquirer/prompts'
import { readConfig, writeConfig, getInstalledItems } from './protocol/config.js'
import { log, success, error, warn, info, heading, item } from '../log.js'

async function removeOne(ref, config) {
  const installed = getInstalledItems(config)
  const entry = installed[ref]

  if (!entry) {
    error(`"${ref}" is not installed.`)
    const names = Object.keys(installed)
    if (names.length) {
      heading('Installed items:')
      for (const n of names) item(n)
    }
    process.exitCode = 1
    return false
  }

  heading(`${ref}@${entry.version}`)
  log()

  if (entry.files?.length) {
    heading('Files to delete:')
    for (const f of entry.files) {
      const exists = existsSync(join(process.cwd(), f))
      item(`${f}${exists ? '' : ' (already missing)'}`)
    }
  }

  if (entry.protocols?.length) {
    // Check if any other installed item also provides these protocols
    const safeToRemove = entry.protocols.filter(p => {
      for (const [name, other] of Object.entries(installed)) {
        if (name !== ref && other.protocols?.includes(p)) return false
      }
      return true
    })
    if (safeToRemove.length) {
      heading('Protocols to remove:')
      for (const p of safeToRemove) item(p)
    }
    const shared = entry.protocols.filter(p => !safeToRemove.includes(p))
    if (shared.length) {
      heading('Protocols kept (provided by other items):')
      for (const p of shared) item(p)
    }
  }

  // npm dependency preview
  const entryDeps = Object.keys(entry.npmDependencies ?? {})
  if (entryDeps.length) {
    const safeToRemoveDeps = entryDeps.filter(dep => {
      for (const [name, other] of Object.entries(installed)) {
        if (name !== ref && other.npmDependencies && dep in other.npmDependencies) return false
      }
      return true
    })
    const sharedDeps = entryDeps.filter(d => !safeToRemoveDeps.includes(d))
    if (safeToRemoveDeps.length) {
      heading('npm dependencies to remove:')
      for (const d of safeToRemoveDeps) item(d)
    }
    if (sharedDeps.length) {
      heading('npm dependencies kept (used by other items):')
      for (const d of sharedDeps) item(d)
    }
  }

  log()
  const ok = await confirm({ message: `Remove ${ref}?` })
  if (!ok) {
    info('Skipped.')
    return false
  }

  // Delete files
  for (const f of entry.files ?? []) {
    const filePath = join(process.cwd(), f)
    if (existsSync(filePath)) {
      await unlink(filePath)
      item(`deleted ${f}`)
    }
  }

  // Remove protocols (only if no other installed item provides them)
  if (config.spec?.protocols) {
    for (const p of entry.protocols ?? []) {
      const providedByOther = Object.entries(installed).some(
        ([name, other]) => name !== ref && other.protocols?.includes(p)
      )
      if (!providedByOther) {
        delete config.spec.protocols[p]
      }
    }
  }

  // Remove npm dependencies from package.json
  const depsToRemove = Object.keys(entry.npmDependencies ?? {}).filter(dep => {
    for (const [name, other] of Object.entries(installed)) {
      if (name !== ref && other.npmDependencies && dep in other.npmDependencies) return false
    }
    return true
  })
  if (depsToRemove.length) {
    try {
      const pkgPath = join(process.cwd(), 'package.json')
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      if (pkg.dependencies) {
        for (const dep of depsToRemove) {
          delete pkg.dependencies[dep]
        }
        await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
        item('updated package.json dependencies')
      }
    } catch {
      warn('could not update package.json')
    }
  }

  // Remove installed record
  delete config.installed[ref]

  return true
}

export async function command(refs) {
  const config = await readConfig()

  let removed = 0
  for (const ref of refs) {
    if (await removeOne(ref, config)) removed++
  }

  if (removed) {
    await writeConfig(config)
    log()
    success(`Removed ${removed} item${removed !== 1 ? 's' : ''}`)
  }
}
