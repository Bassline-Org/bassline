import { search, confirm } from '@inquirer/prompts'
import { readConfig, writeConfig, getProjectProtocols, isInstalledProtocol } from './config.js'
import { log, success, warn, info, item } from '../../log.js'

export async function command() {
  const config = await readConfig()
  const protocols = getProjectProtocols(config)
  const names = Object.keys(protocols)

  if (!names.length) {
    info('No project protocols defined.')
    return
  }

  const name = await search({
    message: 'Protocol to delete:',
    source: async term =>
      names.filter(n => !term || n.toLowerCase().includes(term.toLowerCase())).map(n => ({ value: n, name: n })),
  })

  const proto = protocols[name]
  log()
  item(name)
  if (proto.extends?.length) item(`  extends: ${proto.extends.join(', ')}`)
  item(`  GET: ${(proto.get ?? []).map(s => `"${s}"`).join(', ') || '(none)'}`)
  item(`  PUT: ${(proto.put ?? []).map(s => `"${s}"`).join(', ') || '(none)'}`)

  const source = isInstalledProtocol(config, name)
  if (source) {
    warn(`this protocol was installed by ${source}. Use "bl remove ${source}" instead.`)
  }

  const dependents = Object.entries(protocols)
    .filter(([n, p]) => n !== name && p.extends?.includes(name))
    .map(([n]) => n)
  if (dependents.length) {
    warn(`${dependents.join(', ')} extend${dependents.length === 1 ? 's' : ''} this protocol.`)
  }
  log()

  const ok = await confirm({ message: `Delete ${name} from bassline.config.json?`, default: false })
  if (!ok) {
    info('Cancelled.')
    return
  }

  delete config.spec.protocols[name]

  // Clean up dangling extends references
  for (const [, p] of Object.entries(config.spec.protocols)) {
    if (p.extends) {
      p.extends = p.extends.filter(e => e !== name)
      if (!p.extends.length) delete p.extends
    }
  }

  await writeConfig(config)
  success(`Protocol ${name} deleted.`)
}
