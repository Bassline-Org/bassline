import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function prompt(ctx) {
  return ctx
}

export async function apply(ctx) {
  const { dir, projectName } = ctx

  const config = { name: projectName }

  if (ctx.initLexicon) {
    config.spec = {
      extends: ['@bassline/core'],
      protocols: {},
    }
    config.resources = {}
  }

  await writeFile(join(dir, 'bassline.config.json'), JSON.stringify(config, null, 2) + '\n')

  return ['bassline.config.json']
}
