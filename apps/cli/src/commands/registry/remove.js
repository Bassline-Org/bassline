import { confirm } from '@inquirer/prompts'
import { readConfig, writeConfig } from '../protocol/config.js'
import { log, success, warn, info, item } from '../../log.js'

export async function command(namespace) {
  const config = await readConfig()
  const registries = config.registries ?? {}

  if (!registries[namespace]) {
    info(`Registry "${namespace}" not found.`)
    return
  }

  log(`${namespace} → ${registries[namespace]}`)

  const installed = config.installed ?? {}
  const affected = Object.keys(installed).filter(k => k.startsWith(namespace + '/'))
  if (affected.length) {
    log()
    warn(`${affected.length} installed item(s) use this registry:`)
    for (const name of affected) item(name)
  }

  log()
  const ok = await confirm({ message: `Remove registry ${namespace}?` })
  if (!ok) {
    info('Cancelled.')
    return
  }

  delete config.registries[namespace]
  await writeConfig(config)
  success(`Registry ${namespace} removed.`)
}
