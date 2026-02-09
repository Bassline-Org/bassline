import { input, checkbox, confirm } from '@inquirer/prompts'
import { normalizeSelector } from '@bassline/core/alt'
import { readConfig, writeConfig, getAllProtocolNames, resolveProtocol, getProjectProtocols } from './config.js'
import { log, success, info, item } from '../../log.js'

function validatePascalCase(value) {
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) return 'Must be PascalCase (e.g. Cacheable, SpaceIndex)'
  return true
}

async function promptExtends(config) {
  const available = getAllProtocolNames(config)
  if (!available.length) return []
  return checkbox({
    message: 'Extend protocols:',
    choices: available.map(n => ({ value: n, name: n })),
  })
}

async function promptSelectors(label) {
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
  return selectors
}

function formatProtocol(name, definition, resolved) {
  const parts = [`  Protocol: ${name}`]
  if (definition.extends?.length) parts[0] += ` extends ${definition.extends.join(', ')}`

  const ownGet = definition.get ?? []
  const ownPut = definition.put ?? []
  const inheritedGet = (resolved?.get ?? []).filter(s => !ownGet.includes(s))
  const inheritedPut = (resolved?.put ?? []).filter(s => !ownPut.includes(s))

  const getStr = ownGet.map(s => `"${s}"`).join(', ')
  const getInherited = inheritedGet.length ? ` (+ inherited: ${inheritedGet.map(s => `"${s}"`).join(', ')})` : ''
  parts.push(`    GET: ${getStr || '(none)'}${getInherited}`)

  const putStr = ownPut.map(s => `"${s}"`).join(', ')
  const putInh = inheritedPut.length ? ` (+ inherited: ${inheritedPut.map(s => `"${s}"`).join(', ')})` : ''
  parts.push(`    PUT: ${putStr || '(none)'}${putInh}`)

  return parts.join('\n')
}

export async function command() {
  const config = await readConfig()

  if (!config.spec) {
    config.spec = { extends: ['@bassline/core'], protocols: {} }
  }
  if (!config.spec.protocols) config.spec.protocols = {}

  const name = await input({
    message: 'Protocol name:',
    validate: v => {
      const valid = validatePascalCase(v)
      if (valid !== true) return valid
      if (getProjectProtocols(config)[v]) return `Protocol "${v}" already exists. Use "bl protocol edit" instead.`
      return true
    },
  })

  const description = await input({
    message: 'Description (purpose of this protocol):',
  })

  const extendsArr = await promptExtends(config)
  const getSelectors = await promptSelectors('GET')
  const putSelectors = await promptSelectors('PUT')

  const definition = {}
  if (description.trim()) definition.description = description.trim()
  if (extendsArr.length) definition.extends = extendsArr
  if (getSelectors.length) definition.get = getSelectors
  else definition.get = []
  if (putSelectors.length) definition.put = putSelectors
  else definition.put = []

  config.spec.protocols[name] = definition
  const resolved = resolveProtocol(config, name)

  log()
  log(formatProtocol(name, definition, resolved))
  log()

  const ok = await confirm({ message: 'Add to bassline.config.json?' })
  if (!ok) {
    info('Cancelled.')
    return
  }

  await writeConfig(config)
  success(`Protocol ${name} added.`)
}
