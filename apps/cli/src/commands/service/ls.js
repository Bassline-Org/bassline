import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readConfig } from '../protocol/config.js'
import { log, info, heading, item, label } from '../../log.js'

export async function command() {
  const config = await readConfig()
  const services = config.services ?? {}
  const names = Object.keys(services)

  if (!names.length) {
    info('No services defined. Use "bl service new" to add one.')
    return
  }

  for (const name of names) {
    const svc = services[name]
    const exists = existsSync(join(process.cwd(), svc.path))
    const pathTag = exists ? '' : ' (missing)'

    heading(name)
    if (svc.description) item(svc.description)
    label('path:', `${svc.path}${pathTag}`)
    log()
  }
}
