import { input, search, checkbox, confirm } from '@inquirer/prompts'
import { normalizeSelector } from '@bassline/core/alt'
import {
  readConfig,
  writeConfig,
  getAllProtocolNames,
  getProjectProtocols,
  resolveProtocol,
  isInstalledProtocol,
} from './config.js'
import { log, success, info, item } from '../../log.js'

async function promptExtends(config, current) {
  const available = getAllProtocolNames(config)
  if (!available.length) return current
  return checkbox({
    message: 'Extend protocols:',
    choices: available.map(n => ({
      value: n, name: n, checked: current.includes(n),
    })),
  })
}

async function promptSelectors(label, current) {
  if (current.length) {
    info(`  Current ${label}: ${current.map(s => `"${s}"`).join(', ')}`)
  }

  const selectors = []
  while (true) {
    const keywords = await input({
      message: `${label} selector keywords (space-separated, empty to finish):`,
    })
    if (!keywords.trim()) break
    const normalized = normalizeSelector(
      keywords
        .trim()
        .split(/\s+/)
        .map(k => k + ':')
        .join('')
    )
    item(`→ "${normalized}"`)
    selectors.push(normalized)
  }
  return selectors.length ? selectors : current
}

export async function command() {
  const config = await readConfig()
  const protocols = getProjectProtocols(config)
  const names = Object.keys(protocols)

  if (!names.length) {
    info('No project protocols defined. Use "bl protocol new" first.')
    return
  }

  const name = await search({
    message: 'Protocol to edit:',
    source: async term =>
      names.filter(n => !term || n.toLowerCase().includes(term.toLowerCase())).map(n => ({ value: n, name: n })),
  })

  const current = protocols[name]
  const source = isInstalledProtocol(config, name)
  log()
  item(`Editing: ${name}`)
  if (source) {
    info(`  (installed by ${source})`)
  }

  const newName = await input({
    message: 'Protocol name:',
    default: name,
    validate: v => {
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(v)) return 'Must be PascalCase'
      if (v !== name && protocols[v]) return `Protocol "${v}" already exists.`
      return true
    },
  })

  const description = await input({
    message: 'Description:',
    default: current.description ?? '',
  })

  const extendsArr = await promptExtends(config, current.extends ?? [])
  const getSelectors = await promptSelectors('GET', current.get ?? [])
  const putSelectors = await promptSelectors('PUT', current.put ?? [])

  const definition = {}
  if (description.trim()) definition.description = description.trim()
  if (extendsArr.length) definition.extends = extendsArr
  definition.get = getSelectors
  definition.put = putSelectors

  if (newName !== name) {
    delete config.spec.protocols[name]
    for (const [, p] of Object.entries(config.spec.protocols)) {
      const idx = p.extends?.indexOf(name)
      if (idx !== null && idx >= 0) p.extends[idx] = newName
    }
    // Update installed records if this protocol was tracked
    for (const inst of Object.values(config.installed ?? {})) {
      const idx = inst.protocols?.indexOf(name)
      if (idx !== null && idx >= 0) inst.protocols[idx] = newName
      const iIdx = inst.implements?.indexOf(name)
      if (iIdx !== null && iIdx >= 0) inst.implements[iIdx] = newName
    }
  }
  config.spec.protocols[newName] = definition

  const resolved = resolveProtocol(config, newName)
  const ownGet = definition.get
  const ownPut = definition.put
  const inheritedGet = (resolved?.get ?? []).filter(s => !ownGet.includes(s))
  const inheritedPut = (resolved?.put ?? []).filter(s => !ownPut.includes(s))

  log()
  item(`Protocol: ${newName}${definition.extends ? ` extends ${definition.extends.join(', ')}` : ''}`)
  const getStr = ownGet.map(s => `"${s}"`).join(', ') || '(none)'
  const getInh = inheritedGet.length ? ` (+ inherited: ${inheritedGet.map(s => `"${s}"`).join(', ')})` : ''
  item(`  GET: ${getStr}${getInh}`)
  const putStr = ownPut.map(s => `"${s}"`).join(', ') || '(none)'
  const putInh = inheritedPut.length ? ` (+ inherited: ${inheritedPut.map(s => `"${s}"`).join(', ')})` : ''
  item(`  PUT: ${putStr}${putInh}`)
  log()

  const ok = await confirm({ message: 'Save changes?' })
  if (!ok) {
    info('Cancelled.')
    return
  }

  await writeConfig(config)
  success(`Protocol ${newName} updated.`)
}
