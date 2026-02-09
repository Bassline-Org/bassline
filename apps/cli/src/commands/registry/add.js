import { readConfig, writeConfig } from '../protocol/config.js'
import { success, error, info } from '../../log.js'

export async function command(namespace, url) {
  if (!namespace.startsWith('@')) {
    error('Namespace must start with @ (e.g. @acme)')
    process.exitCode = 1
    return
  }

  const config = await readConfig()
  if (!config.registries) config.registries = {}

  if (config.registries[namespace]) {
    info(`Updating ${namespace}: ${config.registries[namespace]} → ${url}`)
  }

  config.registries[namespace] = url
  await writeConfig(config)
  success(`Registry ${namespace} → ${url}`)
}
