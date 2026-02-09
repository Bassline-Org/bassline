import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { confirm } from '@inquirer/prompts'
import { readConfig, writeConfig, getInstalledItems } from './protocol/config.js'
import { log, success, error, info, heading, item } from '../log.js'

export async function command(ref) {
  const config = await readConfig()
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
    return
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

  log()
  const ok = await confirm({ message: `Remove ${ref}?` })
  if (!ok) {
    info('Cancelled.')
    return
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

  // Remove installed record
  delete config.installed[ref]
  await writeConfig(config)
  log()
  success(`Removed ${ref}`)
}
