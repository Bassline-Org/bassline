import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readConfig, getResourcePath } from '../protocol/config.js'
import { log, info, heading, item, label } from '../../log.js'

export async function command() {
  const config = await readConfig()
  const resources = config.resources ?? {}
  const names = Object.keys(resources)

  if (!names.length) {
    info('No resources defined. Use "bl resource new" to add one.')
    return
  }

  for (const name of names) {
    const r = resources[name]
    const resPath = getResourcePath(r)
    const exists = existsSync(join(process.cwd(), resPath))
    const pathTag = exists ? '' : ' (missing)'

    heading(name)
    if (r.description) item(r.description)
    label('path:', `${resPath}${pathTag}`)
    if (r.implements?.length) label('implements:', r.implements.join(', '))
    if (r.protocols?.length) label('distributes:', r.protocols.join(', '))
    if (r.dependencies && Object.keys(r.dependencies).length)
      label('dependencies:', Object.entries(r.dependencies).map(([k, v]) => `${k}@${v}`).join(', '))
    log()
  }
}
