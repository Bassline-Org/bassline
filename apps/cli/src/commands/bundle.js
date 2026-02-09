import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readConfig } from './protocol/config.js'
import { collectProjectFiles } from './files.js'
import { log, success, info, item } from '../log.js'

export async function command() {
  const config = await readConfig()
  const name = config.name || 'project'
  const files = await collectProjectFiles(process.cwd())

  const bundle = {
    basslineBundle: 1,
    name,
    createdAt: new Date().toISOString(),
    config,
    files,
  }

  const outPath = join(process.cwd(), `${name}.bundle.json`)
  await writeFile(outPath, JSON.stringify(bundle, null, 2) + '\n')

  log()
  success(`Bundled ${name}`)
  item(`${files.length} files → ${name}.bundle.json`)
}
