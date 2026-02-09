import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function prompt(ctx) {
  return ctx
}

export async function apply(ctx) {
  const { dir, projectName } = ctx

  await writeFile(
    join(dir, 'bassline.config.json'),
    JSON.stringify(
      {
        name: projectName,
      },
      null,
      2
    ) + '\n'
  )

  return ['bassline.config.json']
}
