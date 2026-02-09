import { input } from '@inquirer/prompts'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function prompt(ctx) {
  const projectName = await input({
    message: 'Project name:',
    default: ctx.name || 'my-bassline-project',
  })

  return { ...ctx, projectName, dir: projectName }
}

export async function apply(ctx) {
  const { dir, projectName } = ctx

  await mkdir(join(dir, 'scripts'), { recursive: true })
  await mkdir(join(dir, 'resources'), { recursive: true })

  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: projectName,
        version: '0.1.0',
        type: 'module',
        dependencies: {
          '@bassline/core': '^1.0.0',
        },
      },
      null,
      2
    ) + '\n'
  )

  return ['package.json', 'scripts/', 'resources/']
}
