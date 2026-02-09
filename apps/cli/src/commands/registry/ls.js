import { readConfig } from '../protocol/config.js'
import { log, info } from '../../log.js'

export async function command() {
  const config = await readConfig()
  const registries = config.registries ?? {}
  const entries = Object.entries(registries)

  if (!entries.length) {
    info('No registries configured. Use "bl registry add @namespace <url>" to add one.')
    return
  }

  for (const [namespace, url] of entries) {
    log(`${namespace} → ${url}`)
  }
}
