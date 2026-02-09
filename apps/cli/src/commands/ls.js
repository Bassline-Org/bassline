import { readConfig, getInstalledItems } from './protocol/config.js'
import { log, info, heading, label } from '../log.js'

export async function command() {
  const config = await readConfig()
  const installed = getInstalledItems(config)
  const entries = Object.entries(installed)

  if (!entries.length) {
    info('No items installed. Use "bl add @namespace/name" to install one.')
    return
  }

  for (const [name, item] of entries) {
    heading(`${name}@${item.version}`)

    if (item.protocols?.length) {
      label('protocols:', item.protocols.join(', '))
    }
    if (item.implements?.length) {
      label('implements:', item.implements.join(', '))
    }
    if (item.files?.length) {
      label('files:', item.files.join(', '))
    }
    if (item.npmDependencies && Object.keys(item.npmDependencies).length) {
      label('npm deps:', Object.entries(item.npmDependencies).map(([k, v]) => `${k}@${v}`).join(', '))
    }
    log()
  }
}
