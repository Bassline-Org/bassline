import { readConfig, getProjectProtocols, resolveProtocol, isInstalledProtocol } from './config.js'
import { log, info, heading, item } from '../../log.js'

export async function command() {
  const config = await readConfig()
  const projectProtocols = getProjectProtocols(config)
  const names = Object.keys(projectProtocols)

  if (!names.length) {
    info('No project protocols defined. Use "bl protocol new" to add one.')
    return
  }

  for (const name of names) {
    const def = projectProtocols[name]
    const resolved = resolveProtocol(config, name)

    const header = def.extends?.length ? `${name} extends ${def.extends.join(', ')}` : name

    const ownGet = def.get ?? []
    const ownPut = def.put ?? []
    const inheritedGet = (resolved?.get ?? []).filter(s => !ownGet.includes(s))
    const inheritedPut = (resolved?.put ?? []).filter(s => !ownPut.includes(s))

    const source = isInstalledProtocol(config, name)
    const tag = source ? ` [from ${source}]` : ''
    heading(`${header}${tag}`)

    if (def.description) {
      item(def.description)
    }

    const getOwn = ownGet.map(s => `"${s}"`).join(', ')
    const getInh = inheritedGet.length ? ` (+ inherited: ${inheritedGet.map(s => `"${s}"`).join(', ')})` : ''
    item(`GET: ${getOwn || '(none)'}${getInh}`)

    const putOwn = ownPut.map(s => `"${s}"`).join(', ')
    const putInh = inheritedPut.length ? ` (+ inherited: ${inheritedPut.map(s => `"${s}"`).join(', ')})` : ''
    item(`PUT: ${putOwn || '(none)'}${putInh}`)

    log()
  }
}
