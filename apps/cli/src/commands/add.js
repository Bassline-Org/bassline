import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { confirm } from '@inquirer/prompts'
import { coreSpec } from '@bassline/core/alt'
import {
  readConfig,
  writeConfig,
  getProjectProtocols,
  resolveProtocol,
  isInstalledProtocol,
} from './protocol/config.js'
import { log, success, error, warn, info, heading, item } from '../log.js'

function parseItemRef(ref) {
  if (ref.startsWith('./') || ref.startsWith('/') || ref.endsWith('.json')) {
    return { type: 'local', path: ref }
  }
  const match = ref.match(/^(@[^/]+)\/(.+)$/)
  if (!match) return null
  return { type: 'registry', namespace: match[1], name: match[2] }
}

async function fetchItem(ref, config) {
  const parsed = parseItemRef(ref)
  if (!parsed) {
    error(`Invalid item reference: ${ref}`)
    info('Use @namespace/name or ./path/to/item.json')
    process.exitCode = 1
    return null
  }

  if (parsed.type === 'local') {
    try {
      const raw = await readFile(parsed.path, 'utf-8')
      return JSON.parse(raw)
    } catch (e) {
      error(`Failed to read ${parsed.path}: ${e.message}`)
      process.exitCode = 1
      return null
    }
  }

  const registries = config.registries ?? {}
  const baseUrl = registries[parsed.namespace]
  if (!baseUrl) {
    error(`Unknown registry namespace: ${parsed.namespace}`)
    info('Use "bl registry add" to configure it.')
    process.exitCode = 1
    return null
  }

  const url = `${baseUrl.replace(/\/$/, '')}/${parsed.name}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
      process.exitCode = 1
      return null
    }
    return await res.json()
  } catch (e) {
    error(`Failed to fetch ${url}: ${e.message}`)
    process.exitCode = 1
    return null
  }
}

function validateItem(item) {
  const errors = []
  if (!item.name) errors.push('missing "name"')
  if (!item.version) errors.push('missing "version"')
  if (!item.description) errors.push('missing "description"')
  if (item.files) {
    for (const f of item.files) {
      if (!f.path) errors.push('file entry missing "path"')
      else if (f.path.includes('..')) errors.push(`file "${f.path}" contains path traversal`)
      if (!f.content && f.content !== '') errors.push(`file "${f.path}" missing "content"`)
    }
  }
  return errors
}

function formatProtocolPreview(name, def, config) {
  const parts = []
  let header = `    ${name}`
  if (def.extends?.length) header += ` extends ${def.extends.join(', ')}`
  if (def.description) header += ` — ${def.description}`
  parts.push(header)

  // Temporarily add protocol to config to resolve inheritance
  const tempConfig = {
    ...config,
    spec: {
      ...config.spec,
      protocols: { ...(config.spec?.protocols ?? {}), [name]: def },
    },
  }
  const resolved = resolveProtocol(tempConfig, name)

  const ownGet = def.get ?? []
  const ownPut = def.put ?? []
  const inheritedGet = (resolved?.get ?? []).filter(s => !ownGet.includes(s))
  const inheritedPut = (resolved?.put ?? []).filter(s => !ownPut.includes(s))

  const getStr = ownGet.map(s => `"${s}"`).join(', ') || '(none)'
  const getInh = inheritedGet.length ? ` (+ inherited: ${inheritedGet.map(s => `"${s}"`).join(', ')})` : ''
  parts.push(`      GET: ${getStr}${getInh}`)

  const putStr = ownPut.map(s => `"${s}"`).join(', ') || '(none)'
  const putInh = inheritedPut.length ? ` (+ inherited: ${inheritedPut.map(s => `"${s}"`).join(', ')})` : ''
  parts.push(`      PUT: ${putStr}${putInh}`)

  return parts.join('\n')
}

export async function command(ref) {
  const config = await readConfig()

  const fetched = await fetchItem(ref, config)
  if (!fetched) return

  const errors = validateItem(fetched)
  if (errors.length) {
    error('Invalid registry item:')
    for (const e of errors) item(`- ${e}`)
    process.exitCode = 1
    return
  }

  const qualifiedName = parseItemRef(ref)?.type === 'registry' ? ref : `local/${fetched.name}`

  // Check if already installed
  const installed = config.installed ?? {}
  if (installed[qualifiedName]) {
    info(`${qualifiedName}@${installed[qualifiedName].version} is already installed.`)
    const overwrite = await confirm({ message: `Overwrite with ${fetched.version}?` })
    if (!overwrite) {
      info('Cancelled.')
      return
    }
  }

  // Check protocol conflicts
  const projectProtocols = getProjectProtocols(config)
  const coreProtocolNames = Object.keys(coreSpec.protocols)
  const warnings = []
  for (const [protoName] of Object.entries(fetched.protocols ?? {})) {
    if (coreProtocolNames.includes(protoName)) {
      error(`Protocol conflict: "${protoName}" shadows a core protocol.`)
      process.exitCode = 1
      return
    }
    const source = isInstalledProtocol(config, protoName)
    if (source && source !== qualifiedName) {
      error(`Protocol conflict: "${protoName}" is already provided by ${source}.`)
      process.exitCode = 1
      return
    }
    if (projectProtocols[protoName] && !source) {
      warnings.push(`Protocol "${protoName}" exists as a user-defined protocol and will be overwritten.`)
    }
  }

  // Check file conflicts
  const fileConflicts = []
  for (const f of fetched.files ?? []) {
    if (existsSync(join(process.cwd(), f.path))) {
      fileConflicts.push(f.path)
    }
  }

  // Display summary
  log()
  heading(`${qualifiedName}@${fetched.version}`)
  item(fetched.description)

  if (fetched.protocols && Object.keys(fetched.protocols).length) {
    log()
    item('Protocols:')
    for (const [name, def] of Object.entries(fetched.protocols)) {
      log(formatProtocolPreview(name, def, config))
    }
  }

  if (fetched.implements?.length) {
    log()
    item(`Implements: ${fetched.implements.join(', ')}`)
  }

  if (fetched.files?.length) {
    log()
    item('Files:')
    for (const f of fetched.files) {
      const conflict = fileConflicts.includes(f.path) ? ' (exists, will overwrite)' : ''
      const entryTag = f.path.endsWith('/index.js') || f.type === 'entry' ? ' (entry)' : ''
      item(`  ${f.path}${entryTag}${conflict}`)
    }
  }

  if (fetched.npmDependencies && Object.keys(fetched.npmDependencies).length) {
    log()
    item('npm dependencies:')
    for (const [pkg, ver] of Object.entries(fetched.npmDependencies)) {
      item(`  ${pkg}@${ver}`)
    }
  }

  if (fetched.registryDependencies?.length) {
    log()
    item('Registry dependencies:')
    for (const dep of fetched.registryDependencies) {
      const isInstalled = installed[dep] ? ' (installed)' : ' (not installed)'
      item(`  ${dep}${isInstalled}`)
    }
  }

  for (const w of warnings) {
    log()
    warn(w)
  }

  log()
  const ok = await confirm({ message: 'Add to project?' })
  if (!ok) {
    info('Cancelled.')
    return
  }

  // Write files
  for (const f of fetched.files ?? []) {
    const filePath = join(process.cwd(), f.path)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, f.content)
    item(`wrote ${f.path}`)
  }

  // Merge protocols
  if (!config.spec) config.spec = { extends: ['@bassline/core'], protocols: {} }
  if (!config.spec.protocols) config.spec.protocols = {}
  const addedProtocols = []
  for (const [name, def] of Object.entries(fetched.protocols ?? {})) {
    config.spec.protocols[name] = def
    addedProtocols.push(name)
  }

  // Update package.json with npm dependencies
  if (fetched.npmDependencies && Object.keys(fetched.npmDependencies).length) {
    try {
      const pkgPath = join(process.cwd(), 'package.json')
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      if (!pkg.dependencies) pkg.dependencies = {}
      for (const [name, version] of Object.entries(fetched.npmDependencies)) {
        pkg.dependencies[name] = version
      }
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
      item('updated package.json dependencies')
    } catch {
      warn('could not update package.json')
    }
  }

  // Record install
  if (!config.installed) config.installed = {}
  config.installed[qualifiedName] = {
    version: fetched.version,
    files: (fetched.files ?? []).map(f => f.path),
    protocols: addedProtocols,
    implements: fetched.implements ?? [],
  }

  await writeConfig(config)
  log()
  success(`Installed ${qualifiedName}@${fetched.version}`)
}
