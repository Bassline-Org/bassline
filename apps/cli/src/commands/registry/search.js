import { readConfig } from '../protocol/config.js'
import { log, info, error, heading, label } from '../../log.js'

async function fetchIndex(baseUrl) {
  const url = baseUrl.replace(/\/$/, '')
  try {
    const res = await fetch(`${url}/index.json`)
    if (res.ok) return await res.json()
  } catch { /* fall through */ }

  // Fall back to old-style listing
  try {
    const res = await fetch(`${url}/`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.items)) {
        const items = {}
        for (const name of data.items) items[name] = {}
        return { items }
      }
      if (data.items && typeof data.items === 'object') return data
    }
  } catch { /* ignore */ }

  return null
}

function matches(term, entry, name) {
  const lower = term.toLowerCase()
  if (name.toLowerCase().includes(lower)) return true
  if (entry.description?.toLowerCase().includes(lower)) return true
  if (entry.protocols?.some(p => p.toLowerCase().includes(lower))) return true
  if (entry.implements?.some(i => i.toLowerCase().includes(lower))) return true
  return false
}

export async function command(term) {
  const config = await readConfig()
  const registries = config.registries ?? {}
  const entries = Object.entries(registries)

  if (!entries.length) {
    info('No registries configured. Use "bl registry add @namespace <url>" to add one.')
    return
  }

  let totalResults = 0

  for (const [namespace, url] of entries) {
    const index = await fetchIndex(url)
    if (!index) {
      error(`${namespace}: could not fetch index`)
      continue
    }

    const items = index.items ?? {}
    const matched = Object.entries(items).filter(([name, entry]) => matches(term, entry, name))

    if (!matched.length) continue

    heading(namespace)
    for (const [name, entry] of matched) {
      log(`  ${name}`)
      if (entry.version) label('    version:', entry.version)
      if (entry.description) label('    description:', entry.description)
      if (entry.protocols?.length) label('    protocols:', entry.protocols.join(', '))
      if (entry.implements?.length) label('    implements:', entry.implements.join(', '))
    }
    totalResults += matched.length
    log()
  }

  if (!totalResults) {
    info(`No items matching "${term}" found.`)
  }
}
